package handler

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"
	"github.com/mjavint/wgman/model"
	"github.com/mjavint/wgman/store"
	"github.com/mjavint/wgman/util"
	"golang.zx2c4.com/wireguard/wgctrl/wgtypes"
)

// ── List ──────────────────────────────────────────────────────────────────────

func GetClientsAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		clients, err := db.GetClients(true)
		if err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}

		clientList := make([]map[string]interface{}, len(clients))
		for i, client := range clients {
			clientList[i] = map[string]interface{}{
				"id":            client.Client.ID,
				"name":          client.Client.Name,
				"email":         client.Client.Email,
				"private_key":   client.Client.PrivateKey,
				"public_key":    client.Client.PublicKey,
				"preshared_key": client.Client.PresharedKey,
				"allocated_ips": joinStringSlice(client.Client.AllocatedIPs),
				"allowed_ips":   joinStringSlice(client.Client.AllowedIPs),
				"endpoint":      client.Client.Endpoint,
				"enabled":       client.Client.Enabled,
				"created_at":    client.Client.CreatedAt,
				"qr_code":       client.QRCode,
			}
		}

		return JSONResponse(c, true, clientList, "")
	}
}

// ── Create ────────────────────────────────────────────────────────────────────

type ClientCreatePayload struct {
	Name         string `json:"name"`
	Email        string `json:"email"`
	PublicKey    string `json:"public_key"`
	AllowedIPs   string `json:"allowed_ips"`
	AllocatedIPs string `json:"allocated_ips"`
	Endpoint     string `json:"endpoint"`
}

func NewClientAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		var payload ClientCreatePayload
		if err := c.Bind(&payload); err != nil {
			return APIError(c, http.StatusBadRequest, "Invalid request body")
		}

		if payload.Name == "" {
			return APIError(c, http.StatusBadRequest, "Name is required")
		}

		server, err := db.GetServer()
		if err != nil {
			return APIError(c, http.StatusInternalServerError, "Server not configured")
		}

		globalSettings, err := db.GetGlobalSettings()
		if err != nil {
			log.Warn("Failed to get global settings: ", err)
		}

		allocatedIPs := splitString(payload.AllocatedIPs)
		if len(allocatedIPs) == 0 {
			allocatedIPs, err = getAvailableIP(db, server)
			if err != nil {
				return APIError(c, http.StatusInternalServerError, "Failed to allocate IP: "+err.Error())
			}
		}

		allowedIPs := splitString(payload.AllowedIPs)
		if len(allowedIPs) == 0 {
			allowedIPs = []string{"0.0.0.0/0", "::/0"}
		}

		privateKey := ""
		publicKey := payload.PublicKey
		if publicKey == "" {
			key, err := wgtypes.GeneratePrivateKey()
			if err != nil {
				return APIError(c, http.StatusInternalServerError, "Failed to generate key pair: "+err.Error())
			}
			privateKey = key.String()
			publicKey = key.PublicKey().String()
		}

		presharedKey, err := wgtypes.GenerateKey()
		if err != nil {
			return APIError(c, http.StatusInternalServerError, "Failed to generate preshared key: "+err.Error())
		}

		endpoint := payload.Endpoint
		if endpoint == "" && globalSettings.EndpointAddress != "" {
			endpoint = fmt.Sprintf("%s:%d", globalSettings.EndpointAddress, server.Interface.ListenPort)
		}

		now := time.Now().UTC()
		client := model.Client{
			ID:           generateClientID(),
			Name:         payload.Name,
			Email:        payload.Email,
			PrivateKey:   privateKey,
			PublicKey:    publicKey,
			PresharedKey: presharedKey.String(),
			AllocatedIPs: allocatedIPs,
			AllowedIPs:   allowedIPs,
			Endpoint:     endpoint,
			Enabled:      true,
			UseServerDNS: true,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		if err := db.SaveClient(client); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}

		qrCodeSettings := model.QRCodeSettings{Enabled: true, IncludeDNS: true, IncludeMTU: true}
		clientData, err := db.GetClientByID(client.ID, qrCodeSettings)
		if err != nil {
			log.Warn("Failed to get client QR code: ", err)
		}

		return JSONResponse(c, true, map[string]interface{}{
			"id":            client.ID,
			"name":          client.Name,
			"private_key":   client.PrivateKey,
			"public_key":    client.PublicKey,
			"preshared_key": client.PresharedKey,
			"allocated_ips": joinStringSlice(client.AllocatedIPs),
			"qr_code":       clientData.QRCode,
		}, "Client created successfully")
	}
}

// ── Update ────────────────────────────────────────────────────────────────────

type ClientUpdatePayload struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	PublicKey  string `json:"public_key"`
	AllowedIPs string `json:"allowed_ips"`
	Endpoint   string `json:"endpoint"`
	Enabled    bool   `json:"enabled"`
}

func UpdateClientAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		var payload ClientUpdatePayload
		if err := c.Bind(&payload); err != nil {
			return APIError(c, http.StatusBadRequest, "Invalid request body")
		}

		if payload.ID == "" {
			return APIError(c, http.StatusBadRequest, "Client ID is required")
		}

		clients, err := db.GetClients(false)
		if err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}

		var existing *model.Client
		for _, cl := range clients {
			if cl.Client.ID == payload.ID {
				existing = cl.Client
				break
			}
		}

		if existing == nil {
			return APIError(c, http.StatusNotFound, "Client not found")
		}

		existing.Name = payload.Name
		existing.Email = payload.Email
		existing.PublicKey = payload.PublicKey
		existing.AllowedIPs = splitString(payload.AllowedIPs)
		existing.Endpoint = payload.Endpoint
		existing.Enabled = payload.Enabled

		if err := db.SaveClient(*existing); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}

		return JSONResponse(c, true, nil, "Client updated successfully")
	}
}

// ── Set status ────────────────────────────────────────────────────────────────

type ClientStatusPayload struct {
	ID      string `json:"id"`
	Enabled bool   `json:"enabled"`
}

func SetClientStatusAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		var payload ClientStatusPayload
		if err := c.Bind(&payload); err != nil {
			return APIError(c, http.StatusBadRequest, "Invalid request body")
		}

		clients, err := db.GetClients(false)
		if err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}

		var client *model.Client
		for _, cl := range clients {
			if cl.Client.ID == payload.ID {
				client = cl.Client
				break
			}
		}

		if client == nil {
			return APIError(c, http.StatusNotFound, "Client not found")
		}

		client.Enabled = payload.Enabled
		if err := db.SaveClient(*client); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}

		return JSONResponse(c, true, nil, "Client status updated")
	}
}

// ── Delete ────────────────────────────────────────────────────────────────────

func RemoveClientAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		var payload struct {
			ID string `json:"id"`
		}
		if err := c.Bind(&payload); err != nil {
			return APIError(c, http.StatusBadRequest, "Invalid request body")
		}

		if payload.ID == "" {
			return APIError(c, http.StatusBadRequest, "Client ID is required")
		}

		if err := db.DeleteClient(payload.ID); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}

		return JSONResponse(c, true, nil, "Client deleted successfully")
	}
}

// ── Download config ───────────────────────────────────────────────────────────

func DownloadClientConfigAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		clientID := c.QueryParam("clientid")
		if clientID == "" {
			return APIError(c, http.StatusBadRequest, "Missing clientid parameter")
		}

		clientData, err := db.GetClientByID(clientID, model.QRCodeSettings{Enabled: false})
		if err != nil {
			return APIError(c, http.StatusNotFound, "Client not found")
		}

		server, err := db.GetServer()
		if err != nil {
			return APIError(c, http.StatusNotFound, "Server not configured")
		}

		globalSettings, err := db.GetGlobalSettings()
		if err != nil {
			globalSettings = model.GlobalSetting{}
		}

		config := util.BuildClientConfig(*clientData.Client, server, globalSettings)
		c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=%s.conf", clientData.Client.Name))
		c.Response().Header().Set("Content-Type", "text/plain")
		return c.String(http.StatusOK, config)
	}
}

// ── Public client config (no auth) ───────────────────────────────────────────

func GetPublicClientConfigAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		clientID := c.Param("id")
		if clientID == "" {
			return APIError(c, http.StatusBadRequest, "Client ID is required")
		}

		qrCodeSettings := model.QRCodeSettings{Enabled: true, IncludeDNS: true, IncludeMTU: true}
		clientData, err := db.GetClientByID(clientID, qrCodeSettings)
		if err != nil {
			return APIError(c, http.StatusNotFound, "Client not found")
		}

		if _, err := db.GetServer(); err != nil {
			return APIError(c, http.StatusNotFound, "Server config not found")
		}

		globalSettings, _ := db.GetGlobalSettings()

		endpoint := ""
		if ep := os.Getenv("WGUI_ENDPOINT_ADDRESS"); ep != "" {
			endpoint = ep
		}

		allowedIPs := joinStringSlice(clientData.Client.AllowedIPs)
		if allowedIPs == "" {
			allowedIPs = "0.0.0.0/0,::/0"
		}

		dns := joinStringSlice(globalSettings.DNSServers)
		if dns == "" {
			dns = "1.1.1.1,8.8.8.8"
		}

		mtu := 1420
		if globalSettings.MTU > 0 {
			mtu = globalSettings.MTU
		}

		keepalive := 25
		if globalSettings.PersistentKeepalive > 0 {
			keepalive = globalSettings.PersistentKeepalive
		}

		return JSONResponse(c, true, map[string]interface{}{
			"name":                 clientData.Client.Name,
			"private_key":          clientData.Client.PrivateKey,
			"public_key":           clientData.Client.PublicKey,
			"address":              joinStringSlice(clientData.Client.AllocatedIPs),
			"dns":                  dns,
			"allowed_ips":          allowedIPs,
			"endpoint":             endpoint,
			"mtu":                  mtu,
			"persistent_keepalive": keepalive,
			"qr_code":              clientData.QRCode,
		}, "")
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func getAvailableIP(db store.IStore, server model.Server) ([]string, error) {
	allocatedIPs, err := util.GetAllocatedIPs("")
	if err != nil {
		return nil, fmt.Errorf("failed to get allocated IPs: %v", err)
	}

	ip, err := util.GetAvailableIP(server.Interface.Addresses[0], allocatedIPs, server.Interface.Addresses)
	if err != nil {
		return nil, fmt.Errorf("failed to get available IP: %v", err)
	}

	return []string{fmt.Sprintf("%s/32", ip)}, nil
}
