package handler

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"
	"github.com/mjavint/wgman/model"
	"github.com/mjavint/wgman/store"
	"github.com/mjavint/wgman/util"
	"golang.zx2c4.com/wireguard/wgctrl/wgtypes"
)

// ── Get server config ─────────────────────────────────────────────────────────

func GetServerConfigAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		server, err := db.GetServer()
		if err != nil {
			return APIError(c, http.StatusNotFound, "Server config not found")
		}

		globalSettings, err := db.GetGlobalSettings()

		resp := map[string]interface{}{
			"private_key":          "",
			"public_key":           "",
			"address":              joinStringSlice(server.Interface.Addresses),
			"listen_port":          server.Interface.ListenPort,
			"dns":                  "",
			"firewall_mark":        "",
			"post_up":              server.Interface.PostUp,
			"post_down":            server.Interface.PostDown,
			"endpoint_address":     "",
			"mtu":                  0,
			"persistent_keepalive": 0,
			"config_file_path":     "",
			"table":                "auto",
		}

		if server.KeyPair != nil {
			resp["private_key"] = server.KeyPair.PrivateKey
			resp["public_key"] = server.KeyPair.PublicKey
		}

		if err == nil {
			resp["endpoint_address"] = globalSettings.EndpointAddress
			resp["dns"] = joinStringSlice(globalSettings.DNSServers)
			resp["firewall_mark"] = globalSettings.FirewallMark
			resp["mtu"] = globalSettings.MTU
			resp["persistent_keepalive"] = globalSettings.PersistentKeepalive
			resp["config_file_path"] = globalSettings.ConfigFilePath
			resp["table"] = globalSettings.Table
		}

		return JSONResponse(c, true, resp, "")
	}
}

// ── Update server config ──────────────────────────────────────────────────────

type ServerConfigPayload struct {
	PrivateKey          string `json:"private_key"`
	Address             string `json:"address"`
	ListenPort          int    `json:"listen_port"`
	DNS                 string `json:"dns"`
	FirewallMark        string `json:"firewall_mark"`
	PostUp              string `json:"post_up"`
	PostDown            string `json:"post_down"`
	EndpointAddress     string `json:"endpoint_address"`
	MTU                 int    `json:"mtu"`
	PersistentKeepalive int    `json:"persistent_keepalive"`
	ConfigFilePath      string `json:"config_file_path"`
	Table               string `json:"table"`
}

func UpdateServerConfigAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		var payload ServerConfigPayload
		if err := c.Bind(&payload); err != nil {
			return APIError(c, http.StatusBadRequest, "Invalid request body")
		}

		server, err := db.GetServer()
		if err != nil {
			return APIError(c, http.StatusNotFound, "Server not configured")
		}

		if payload.PrivateKey != "" {
			server.KeyPair.PrivateKey = payload.PrivateKey
		}
		if payload.Address != "" {
			server.Interface.Addresses = splitString(payload.Address)
		}
		if payload.ListenPort > 0 {
			server.Interface.ListenPort = payload.ListenPort
		}
		server.Interface.PostUp = payload.PostUp
		server.Interface.PostDown = payload.PostDown

		if err := db.SaveServerInterface(*server.Interface); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}
		if err := db.SaveServerKeyPair(*server.KeyPair); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}

		globalSettings, err := db.GetGlobalSettings()
		if err == nil {
			globalSettings.EndpointAddress = payload.EndpointAddress
			globalSettings.DNSServers = splitString(payload.DNS)
			globalSettings.FirewallMark = payload.FirewallMark
			globalSettings.MTU = payload.MTU
			globalSettings.PersistentKeepalive = payload.PersistentKeepalive
			globalSettings.ConfigFilePath = payload.ConfigFilePath
			globalSettings.Table = payload.Table
			if globalSettings.Table == "" {
				globalSettings.Table = "auto"
			}
			if err := db.SaveGlobalSettings(globalSettings); err != nil {
				log.Warn("Failed to save global settings: ", err)
			}
		}

		if util.ManageRestart || util.ManageStart {
			log.Infof("Restarting WireGuard interface after config update...")
			if err := util.RestartWireGuard(globalSettings.ConfigFilePath); err != nil {
				log.Warnf("Cannot restart WireGuard: %v", err)
			}
		}

		return JSONResponse(c, true, nil, "Server config updated")
	}
}

// ── Generate key pair ─────────────────────────────────────────────────────────

func GenerateServerKeyPairAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		key, err := wgtypes.GeneratePrivateKey()
		if err != nil {
			return APIError(c, http.StatusInternalServerError, "Failed to generate key pair: "+err.Error())
		}

		serverKeyPair := model.ServerKeypair{
			PrivateKey: key.String(),
			PublicKey:  key.PublicKey().String(),
			UpdatedAt:  time.Now().UTC(),
		}

		if err := db.SaveServerKeyPair(serverKeyPair); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}

		log.Infof("Generated new server key pair")

		return JSONResponse(c, true, map[string]interface{}{
			"private_key": serverKeyPair.PrivateKey,
			"public_key":  serverKeyPair.PublicKey,
		}, "Key pair generated successfully")
	}
}
