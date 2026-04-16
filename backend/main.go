package main

import (
	"crypto/sha512"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
	"github.com/mjavint/wgman/store"
	"github.com/mjavint/wgman/telegram"

	"github.com/mjavint/wgman/emailer"
	"github.com/mjavint/wgman/handler"
	"github.com/mjavint/wgman/router"
	"github.com/mjavint/wgman/store/jsondb"
	"github.com/mjavint/wgman/util"
)

var (
	// command-line banner information
	appVersion = "development"
	gitCommit  = "N/A"
	gitRef     = "N/A"
	buildTime  = fmt.Sprintf(time.Now().UTC().Format("01-02-2006 15:04:05"))
	// configuration variables
	flagDisableLogin             = false
	flagBindAddress              = "0.0.0.0:5000"
	flagSmtpHostname             = "127.0.0.1"
	flagSmtpPort                 = 25
	flagSmtpUsername             string
	flagSmtpPassword             string
	flagSmtpAuthType             = "NONE"
	flagSmtpNoTLSCheck           = false
	flagSmtpEncryption           = "STARTTLS"
	flagSmtpHelo                 = "localhost"
	flagSendgridApiKey           string
	flagEmailFrom                string
	flagEmailFromName            = "WireGuard UI"
	flagTelegramToken            string
	flagTelegramAllowConfRequest = false
	flagTelegramFloodWait        = 60
	flagSessionSecret            = util.RandomString(32)
	flagSessionMaxDuration       = 90
	flagWgConfTemplate           string
	flagBasePath                 string
	flagSubnetRanges             string
)

const (
	defaultEmailSubject = "Your wireguard configuration"
	defaultEmailContent = `Hi,</br>
<p>In this email you can find your personal configuration for our wireguard server.</p>

<p>Best</p>
`
)

// embed the "templates" directory
//
//go:embed templates/*
var embeddedTemplates embed.FS

//go:embed assets
var embeddedAssets embed.FS

func init() {
	// command-line flags and env variables
	flag.BoolVar(&flagDisableLogin, "disable-login", util.LookupEnvOrBool("DISABLE_LOGIN", flagDisableLogin), "Disable authentication on the app. This is potentially dangerous.")
	flag.StringVar(&flagBindAddress, "bind-address", util.LookupEnvOrString("BIND_ADDRESS", flagBindAddress), "Address:Port to which the app will be bound.")
	flag.StringVar(&flagSmtpHostname, "smtp-hostname", util.LookupEnvOrString("SMTP_HOSTNAME", flagSmtpHostname), "SMTP Hostname")
	flag.IntVar(&flagSmtpPort, "smtp-port", util.LookupEnvOrInt("SMTP_PORT", flagSmtpPort), "SMTP Port")
	flag.StringVar(&flagSmtpHelo, "smtp-helo", util.LookupEnvOrString("SMTP_HELO", flagSmtpHelo), "SMTP HELO Hostname")
	flag.StringVar(&flagSmtpUsername, "smtp-username", util.LookupEnvOrString("SMTP_USERNAME", flagSmtpUsername), "SMTP Username")
	flag.BoolVar(&flagSmtpNoTLSCheck, "smtp-no-tls-check", util.LookupEnvOrBool("SMTP_NO_TLS_CHECK", flagSmtpNoTLSCheck), "Disable TLS verification for SMTP. This is potentially dangerous.")
	flag.StringVar(&flagSmtpEncryption, "smtp-encryption", util.LookupEnvOrString("SMTP_ENCRYPTION", flagSmtpEncryption), "SMTP Encryption : NONE, SSL, SSLTLS, TLS or STARTTLS (by default)")
	flag.StringVar(&flagSmtpAuthType, "smtp-auth-type", util.LookupEnvOrString("SMTP_AUTH_TYPE", flagSmtpAuthType), "SMTP Auth Type : PLAIN, LOGIN or NONE.")
	flag.StringVar(&flagEmailFrom, "email-from", util.LookupEnvOrString("EMAIL_FROM_ADDRESS", flagEmailFrom), "'From' email address.")
	flag.StringVar(&flagEmailFromName, "email-from-name", util.LookupEnvOrString("EMAIL_FROM_NAME", flagEmailFromName), "'From' email name.")
	flag.StringVar(&flagTelegramToken, "telegram-token", util.LookupEnvOrString("TELEGRAM_TOKEN", flagTelegramToken), "Telegram bot token for distributing configs to clients.")
	flag.BoolVar(&flagTelegramAllowConfRequest, "telegram-allow-conf-request", util.LookupEnvOrBool("TELEGRAM_ALLOW_CONF_REQUEST", flagTelegramAllowConfRequest), "Allow users to get configs from the bot by sending a message.")
	flag.IntVar(&flagTelegramFloodWait, "telegram-flood-wait", util.LookupEnvOrInt("TELEGRAM_FLOOD_WAIT", flagTelegramFloodWait), "Time in minutes before the next conf request is processed.")
	flag.StringVar(&flagWgConfTemplate, "wg-conf-template", util.LookupEnvOrString("WG_CONF_TEMPLATE", flagWgConfTemplate), "Path to custom wg.conf template.")
	flag.StringVar(&flagBasePath, "base-path", util.LookupEnvOrString("BASE_PATH", flagBasePath), "The base path of the URL")
	flag.StringVar(&flagSubnetRanges, "subnet-ranges", util.LookupEnvOrString("SUBNET_RANGES", flagSubnetRanges), "IP ranges to choose from when assigning an IP for a client.")
	flag.IntVar(&flagSessionMaxDuration, "session-max-duration", util.LookupEnvOrInt("SESSION_MAX_DURATION", flagSessionMaxDuration), "Max time in days a remembered session is refreshed and valid.")

	var (
		smtpPasswordLookup   = util.LookupEnvOrString("SMTP_PASSWORD", flagSmtpPassword)
		sendgridApiKeyLookup = util.LookupEnvOrString("SENDGRID_API_KEY", flagSendgridApiKey)
		sessionSecretLookup  = util.LookupEnvOrString("SESSION_SECRET", flagSessionSecret)
	)

	// check empty smtpPassword env var
	if smtpPasswordLookup != "" {
		flag.StringVar(&flagSmtpPassword, "smtp-password", smtpPasswordLookup, "SMTP Password")
	} else {
		flag.StringVar(&flagSmtpPassword, "smtp-password", util.LookupEnvOrFile("SMTP_PASSWORD_FILE", flagSmtpPassword), "SMTP Password File")
	}

	// check empty sendgridApiKey env var
	if sendgridApiKeyLookup != "" {
		flag.StringVar(&flagSendgridApiKey, "sendgrid-api-key", sendgridApiKeyLookup, "Your sendgrid api key.")
	} else {
		flag.StringVar(&flagSendgridApiKey, "sendgrid-api-key", util.LookupEnvOrFile("SENDGRID_API_KEY_FILE", flagSendgridApiKey), "File containing your sendgrid api key.")
	}

	// check empty sessionSecret env var
	if sessionSecretLookup != "" {
		flag.StringVar(&flagSessionSecret, "session-secret", sessionSecretLookup, "The key used to encrypt session cookies.")
	} else {
		flag.StringVar(&flagSessionSecret, "session-secret", util.LookupEnvOrFile("SESSION_SECRET_FILE", flagSessionSecret), "File containing the key used to encrypt session cookies.")
	}

	flag.Parse()

	// update runtime config
	util.DisableLogin = flagDisableLogin
	util.BindAddress = flagBindAddress
	util.SmtpHostname = flagSmtpHostname
	util.SmtpPort = flagSmtpPort
	util.SmtpHelo = flagSmtpHelo
	util.SmtpUsername = flagSmtpUsername
	util.SmtpPassword = flagSmtpPassword
	util.SmtpAuthType = flagSmtpAuthType
	util.SmtpNoTLSCheck = flagSmtpNoTLSCheck
	util.SmtpEncryption = flagSmtpEncryption
	util.SendgridApiKey = flagSendgridApiKey
	util.EmailFrom = flagEmailFrom
	util.EmailFromName = flagEmailFromName
	util.SessionSecret = sha512.Sum512([]byte(flagSessionSecret))
	util.SessionMaxDuration = int64(flagSessionMaxDuration) * 86_400 // Store in seconds
	util.WgConfTemplate = flagWgConfTemplate
	util.BasePath = util.ParseBasePath(flagBasePath)
	util.SubnetRanges = util.ParseSubnetRanges(flagSubnetRanges)

	util.InitManageFlags()

	lvl, _ := util.ParseLogLevel(util.LookupEnvOrString(util.LogLevel, "INFO"))

	telegram.Token = flagTelegramToken
	telegram.AllowConfRequest = flagTelegramAllowConfRequest
	telegram.FloodWait = flagTelegramFloodWait
	telegram.LogLevel = lvl

	// print only if log level is INFO or lower
	if lvl <= log.INFO {
		// print app information
		fmt.Println("Wireguard UI")
		fmt.Println("App Version\t:", appVersion)
		fmt.Println("Git Commit\t:", gitCommit)
		fmt.Println("Git Ref\t\t:", gitRef)
		fmt.Println("Build Time\t:", buildTime)
		fmt.Println("Git Repo\t:", "https://github.com/mjavint/wgman/backend")
		fmt.Println("Authentication\t:", !util.DisableLogin)
		fmt.Println("Bind address\t:", util.BindAddress)
		fmt.Println("Email from\t:", util.EmailFrom)
		fmt.Println("Email from name\t:", util.EmailFromName)
		fmt.Println("Custom wg.conf\t:", util.WgConfTemplate)
		fmt.Println("Base path\t:", util.BasePath+"/")
		fmt.Println("Subnet ranges\t:", util.GetSubnetRangesString())
	}
}

func main() {
	db, err := jsondb.New("./db")
	if err != nil {
		panic(err)
	}
	if err := db.Init(); err != nil {
		panic(err)
	}
	// set app extra data
	extraData := make(map[string]interface{})
	extraData["appVersion"] = appVersion
	extraData["gitCommit"] = gitCommit
	extraData["basePath"] = util.BasePath
	extraData["loginDisabled"] = flagDisableLogin

	// strip the "templates/" prefix from the embedded directory
	tmplDir, _ := fs.Sub(fs.FS(embeddedTemplates), "templates")

	// create the wireguard config on start, if it doesn't exist
	initServerConfig(db, tmplDir)

	// Initialize hashes only if they don't exist yet (first run).
	// Do NOT overwrite existing hashes on restart — that would hide pending changes
	// that were made between the last Apply and the current startup.
	if hashes, err := db.GetHashes(); err != nil || (hashes.Client == "" && hashes.Server == "") {
		if err := util.UpdateHashes(db); err != nil {
			log.Warnf("Cannot initialize hashes: %v", err)
		}
	}

	// Auto-start WireGuard after config is ready
	if util.ManageStart || util.ManageRestart {
		if settings, err := db.GetGlobalSettings(); err == nil {
			if !util.IsWireGuardRunning(settings.ConfigFilePath) {
				log.Infof("Auto-starting WireGuard interface...")
				if err := util.StartWireGuard(settings.ConfigFilePath); err != nil {
					log.Warnf("Cannot auto-start WireGuard: %v", err)
				}
			} else {
				log.Infof("WireGuard interface already running")
			}
		}
	}

	// Check if subnet ranges are valid for the server configuration
	if err := util.ValidateAndFixSubnetRanges(db); err != nil {
		panic(err)
	}

	// Print valid ranges
	if lvl, _ := util.ParseLogLevel(util.LookupEnvOrString(util.LogLevel, "INFO")); lvl <= log.INFO {
		fmt.Println("Valid subnet ranges:", util.GetSubnetRangesString())
	}

	// register routes
	app := router.New(tmplDir, extraData, util.SessionSecret)

	// Health check & favicon
	app.GET(util.BasePath+"/_health", handler.Health())
	app.GET(util.BasePath+"/favicon", handler.Favicon())

	// Auth routes (JSON API — no templates)
	if !util.DisableLogin {
		app.POST(util.BasePath+"/login", handler.Login(db), handler.ContentTypeJson)
		app.POST(util.BasePath+"/logout", handler.Logout(), handler.ValidSession)
	}

	var sendmail emailer.Emailer
	if util.SendgridApiKey != "" {
		sendmail = emailer.NewSendgridApiMail(util.SendgridApiKey, util.EmailFromName, util.EmailFrom)
	} else {
		sendmail = emailer.NewSmtpMail(util.SmtpHostname, util.SmtpPort, util.SmtpUsername, util.SmtpPassword, util.SmtpHelo, util.SmtpNoTLSCheck, util.SmtpAuthType, util.EmailFromName, util.EmailFrom, util.SmtpEncryption)
	}

	// API routes consumed by the React frontend
	app.GET(util.BasePath+"/api/status", handler.GetStatusAPI(db), handler.ValidSession)
	app.GET(util.BasePath+"/api/clients", handler.GetClientsAPI(db), handler.ValidSession)
	app.POST(util.BasePath+"/api/client/new", handler.NewClientAPI(db), handler.ValidSession, handler.ContentTypeJson)
	app.POST(util.BasePath+"/api/client/update", handler.UpdateClientAPI(db), handler.ValidSession, handler.ContentTypeJson)
	app.POST(util.BasePath+"/api/client/set-status", handler.SetClientStatusAPI(db), handler.ValidSession, handler.ContentTypeJson)
	app.POST(util.BasePath+"/api/client/delete", handler.RemoveClientAPI(db), handler.ValidSession, handler.ContentTypeJson)
	app.GET(util.BasePath+"/api/server", handler.GetServerConfigAPI(db), handler.ValidSession)
	app.POST(util.BasePath+"/api/server/update", handler.UpdateServerConfigAPI(db), handler.ValidSession, handler.ContentTypeJson)
	app.POST(util.BasePath+"/api/server/keypair", handler.GenerateServerKeyPairAPI(db), handler.ValidSession, handler.ContentTypeJson)
	app.GET(util.BasePath+"/api/machine-ips", handler.MachineIPAddresses(), handler.ValidSession)
	app.GET(util.BasePath+"/api/subnet-ranges", handler.GetOrderedSubnetRanges(), handler.ValidSession)
	app.GET(util.BasePath+"/api/suggest-client-ips", handler.SuggestIPAllocation(db), handler.ValidSession)
	app.POST(util.BasePath+"/api/apply-wg-config", handler.ApplyServerConfig(db, tmplDir), handler.ValidSession, handler.ContentTypeJson)
	app.GET(util.BasePath+"/api/pending-changes", handler.GetPendingChanges(db), handler.ValidSession)
	app.GET(util.BasePath+"/api/wg/interface-status", handler.WgInterfaceStatusAPI(db), handler.ValidSession)
	app.POST(util.BasePath+"/api/wg/start", handler.WgStartAPI(db), handler.ValidSession)
	app.POST(util.BasePath+"/api/wg/stop", handler.WgStopAPI(db), handler.ValidSession)
	app.POST(util.BasePath+"/api/wg/restart", handler.WgRestartAPI(db), handler.ValidSession)
	app.GET(util.BasePath+"/api/download", handler.DownloadClientConfigAPI(db), handler.ValidSession)
	app.POST(util.BasePath+"/api/email-client", handler.EmailClient(db, sendmail, defaultEmailSubject, defaultEmailContent), handler.ValidSession, handler.ContentTypeJson)

	// Public API routes (no auth required)
	app.GET(util.BasePath+"/api/public/client/:id", handler.GetPublicClientConfigAPI(db))

	// User management API
	if !util.DisableLogin {
		app.GET(util.BasePath+"/api/users", handler.GetUsers(db), handler.ValidSession, handler.NeedsAdmin)
		app.GET(util.BasePath+"/api/user/:username", handler.GetUser(db), handler.ValidSession)
		app.POST(util.BasePath+"/api/update-user", handler.UpdateUser(db), handler.ValidSession, handler.ContentTypeJson)
		app.POST(util.BasePath+"/api/create-user", handler.CreateUser(db), handler.ValidSession, handler.ContentTypeJson, handler.NeedsAdmin)
		app.POST(util.BasePath+"/api/remove-user", handler.RemoveUser(db), handler.ValidSession, handler.ContentTypeJson, handler.NeedsAdmin)
	}

	// Serve React SPA static assets (JS, CSS, images)
	// The static middleware serves files from the embedded "assets" directory.
	// It calls next() when a file is not found, so API routes are unaffected.
	app.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Root:       "assets",
		Browse:     false,
		Filesystem: http.FS(embeddedAssets),
	}))

	// SPA catch-all: serve index.html for any GET route not matched above.
	// React Router handles client-side navigation (/clients, /server, /login, etc.)
	app.GET("/*", func(c echo.Context) error {
		f, err := embeddedAssets.Open("assets/index.html")
		if err != nil {
			return echo.ErrNotFound
		}
		defer f.Close()
		return c.Stream(http.StatusOK, "text/html; charset=utf-8", f)
	})

	initDeps := telegram.TgBotInitDependencies{
		DB:                             db,
		SendRequestedConfigsToTelegram: util.SendRequestedConfigsToTelegram,
	}

	initTelegram(initDeps)

	if strings.HasPrefix(util.BindAddress, "unix://") {
		err := syscall.Unlink(util.BindAddress[6:])
		if err != nil {
			app.Logger.Fatalf("Cannot unlink unix socket: Error: %v", err)
		}
		l, err := net.Listen("unix", util.BindAddress[6:])
		if err != nil {
			app.Logger.Fatalf("Cannot create unix socket. Error: %v", err)
		}
		app.Listener = l
		app.Logger.Fatal(app.Start(""))
	} else {
		app.Logger.Fatal(app.Start(util.BindAddress))
	}
}

func initServerConfig(db store.IStore, tmplDir fs.FS) {
	settings, err := db.GetGlobalSettings()
	if err != nil {
		log.Fatalf("Cannot get global settings: %v", err)
	}

	if _, err := os.Stat(settings.ConfigFilePath); err == nil {
		return
	}

	server, err := db.GetServer()
	if err != nil {
		log.Fatalf("Cannot get server config: %v", err)
	}

	clients, err := db.GetClients(false)
	if err != nil {
		log.Fatalf("Cannot get client config: %v", err)
	}

	users, err := db.GetUsers()
	if err != nil {
		log.Fatalf("Cannot get user config: %v", err)
	}

	err = util.WriteWireGuardServerConfig(tmplDir, server, clients, users, settings)
	if err != nil {
		log.Fatalf("Cannot create server config: %v", err)
	}
}

func initTelegram(initDeps telegram.TgBotInitDependencies) {
	go func() {
		for {
			err := telegram.Start(initDeps)
			if err == nil {
				break
			}
		}
	}()
}
