package handler

import (
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"
	"github.com/mjavint/wgman/store"
	"github.com/mjavint/wgman/util"
)

// ── Types ─────────────────────────────────────────────────────────────────────

type PeerInfo struct {
	PublicKey       string `json:"public_key"`
	Endpoint        string `json:"endpoint"`
	AllowedIPs      string `json:"allowed_ips"`
	LatestHandshake string `json:"latest_handshake"`
	TransferRX      string `json:"transfer_rx"`
	TransferTX      string `json:"transfer_tx"`
}

type WireGuardStatus struct {
	Device string     `json:"device"`
	Peers  []PeerInfo `json:"peers"`
}

// ── parseWgShowDump ───────────────────────────────────────────────────────────
//
// Parses the output of `wg show all dump`.
// Interface lines have 5 tab-separated fields:
//
//	<iface> <private_key> <public_key> <listen_port> <fwmark>
//
// Peer lines have 9 tab-separated fields:
//
//	<iface> <pub_key> <preshared_key> <endpoint> <allowed_ips> <handshake_epoch> <rx_bytes> <tx_bytes> <keepalive>
func parseWgShowDump(output string) []WireGuardStatus {
	devMap := map[string]*WireGuardStatus{}
	devOrder := []string{}

	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		fields := strings.Split(line, "\t")
		switch len(fields) {
		case 5: // interface line
			iface := fields[0]
			if _, exists := devMap[iface]; !exists {
				devMap[iface] = &WireGuardStatus{Device: iface, Peers: []PeerInfo{}}
				devOrder = append(devOrder, iface)
			}
		case 9: // peer line
			iface := fields[0]
			if _, exists := devMap[iface]; !exists {
				devMap[iface] = &WireGuardStatus{Device: iface, Peers: []PeerInfo{}}
				devOrder = append(devOrder, iface)
			}
			handshakeStr := "0001-01-01 00:00:00"
			if epoch, err := strconv.ParseInt(fields[5], 10, 64); err == nil && epoch > 0 {
				handshakeStr = time.Unix(epoch, 0).UTC().Format("2006-01-02 15:04:05")
			}
			endpoint := fields[3]
			if endpoint == "(none)" {
				endpoint = ""
			}
			allowedIPs := fields[4]
			if allowedIPs == "(none)" {
				allowedIPs = ""
			}
			devMap[iface].Peers = append(devMap[iface].Peers, PeerInfo{
				PublicKey:       fields[1],
				Endpoint:        endpoint,
				AllowedIPs:      allowedIPs,
				LatestHandshake: handshakeStr,
				TransferRX:      fields[6],
				TransferTX:      fields[7],
			})
		}
	}

	result := make([]WireGuardStatus, 0, len(devOrder))
	for _, iface := range devOrder {
		result = append(result, *devMap[iface])
	}
	return result
}

// ── Status ────────────────────────────────────────────────────────────────────

func GetStatusAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		out, err := exec.Command("sudo", "-n", "wg", "show", "all", "dump").Output()
		if err != nil {
			return JSONResponse(c, true, []WireGuardStatus{}, "")
		}
		return JSONResponse(c, true, parseWgShowDump(string(out)), "")
	}
}

// ── Interface status ──────────────────────────────────────────────────────────

func WgInterfaceStatusAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		settings, err := db.GetGlobalSettings()
		if err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}
		return JSONResponse(c, true, map[string]interface{}{
			"running":    util.IsWireGuardRunning(settings.ConfigFilePath),
			"interface":  util.GetInterfaceName(settings.ConfigFilePath),
			"manageable": util.ManageStart || util.ManageRestart,
		}, "")
	}
}

// ── Start / Stop / Restart ────────────────────────────────────────────────────

func WgStartAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		settings, err := db.GetGlobalSettings()
		if err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}
		log.Infof("Starting WireGuard interface via API...")
		if err := util.StartWireGuard(settings.ConfigFilePath); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}
		return JSONResponse(c, true, nil, "WireGuard started successfully")
	}
}

func WgStopAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		settings, err := db.GetGlobalSettings()
		if err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}
		log.Infof("Stopping WireGuard interface via API...")
		if err := util.StopWireGuard(settings.ConfigFilePath); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}
		return JSONResponse(c, true, nil, "WireGuard stopped successfully")
	}
}

func WgRestartAPI(db store.IStore) echo.HandlerFunc {
	return func(c echo.Context) error {
		settings, err := db.GetGlobalSettings()
		if err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}
		log.Infof("Restarting WireGuard interface via API...")
		if err := util.RestartWireGuard(settings.ConfigFilePath); err != nil {
			return APIError(c, http.StatusInternalServerError, err.Error())
		}
		return JSONResponse(c, true, nil, "WireGuard restarted successfully")
	}
}
