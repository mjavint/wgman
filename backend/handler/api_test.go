package handler

import (
	"strconv"
	"testing"
	"time"
)

// ── parseWgShowDump tests ─────────────────────────────────────────────────────

func TestParseWgShowDump_Empty(t *testing.T) {
	result := parseWgShowDump("")
	if len(result) != 0 {
		t.Errorf("expected 0 devices, got %d", len(result))
	}
}

func TestParseWgShowDump_InterfaceOnly(t *testing.T) {
	input := "wg0\tABC123privatekey\tABC123publickey\t51820\toff"
	result := parseWgShowDump(input)
	if len(result) != 1 {
		t.Fatalf("expected 1 device, got %d", len(result))
	}
	if result[0].Device != "wg0" {
		t.Errorf("expected device wg0, got %s", result[0].Device)
	}
	if len(result[0].Peers) != 0 {
		t.Errorf("expected 0 peers, got %d", len(result[0].Peers))
	}
}

func TestParseWgShowDump_WithPeer(t *testing.T) {
	epoch := time.Now().Add(-30 * time.Second).Unix()
	input := "wg0\tprivkey\tpubkey\t51820\toff\n" +
		"wg0\tPEERPUBKEY\t(none)\t192.168.1.10:51820\t10.0.0.2/32\t" +
		itoa(epoch) + "\t1024\t2048\t25"
	result := parseWgShowDump(input)
	if len(result) != 1 {
		t.Fatalf("expected 1 device, got %d", len(result))
	}
	dev := result[0]
	if len(dev.Peers) != 1 {
		t.Fatalf("expected 1 peer, got %d", len(dev.Peers))
	}
	peer := dev.Peers[0]
	if peer.PublicKey != "PEERPUBKEY" {
		t.Errorf("unexpected public key: %s", peer.PublicKey)
	}
	if peer.Endpoint != "192.168.1.10:51820" {
		t.Errorf("unexpected endpoint: %s", peer.Endpoint)
	}
	if peer.AllowedIPs != "10.0.0.2/32" {
		t.Errorf("unexpected allowed IPs: %s", peer.AllowedIPs)
	}
	if peer.TransferRX != "1024" {
		t.Errorf("unexpected rx: %s", peer.TransferRX)
	}
	if peer.TransferTX != "2048" {
		t.Errorf("unexpected tx: %s", peer.TransferTX)
	}
	// Handshake must NOT be zero time since epoch > 0
	if peer.LatestHandshake == "0001-01-01 00:00:00" {
		t.Errorf("expected real handshake timestamp, got zero time")
	}
}

func TestParseWgShowDump_NoneValues(t *testing.T) {
	input := "wg0\tprivkey\tpubkey\t51820\toff\n" +
		"wg0\tPEERPUBKEY\t(none)\t(none)\t(none)\t0\t0\t0\t0"
	result := parseWgShowDump(input)
	peer := result[0].Peers[0]
	if peer.Endpoint != "" {
		t.Errorf("expected empty endpoint, got %q", peer.Endpoint)
	}
	if peer.AllowedIPs != "" {
		t.Errorf("expected empty allowedIPs, got %q", peer.AllowedIPs)
	}
	if peer.LatestHandshake != "0001-01-01 00:00:00" {
		t.Errorf("expected zero handshake, got %q", peer.LatestHandshake)
	}
}

func TestParseWgShowDump_MultipleDevicesAndPeers(t *testing.T) {
	input := "wg0\tpk0\tpub0\t51820\toff\n" +
		"wg0\tPEER0\t(none)\t10.0.0.1:51820\t10.1.0.1/32\t1000\t100\t200\t0\n" +
		"wg1\tpk1\tpub1\t51821\toff\n" +
		"wg1\tPEER1\t(none)\t10.0.0.2:51820\t10.2.0.1/32\t2000\t300\t400\t25"
	result := parseWgShowDump(input)
	if len(result) != 2 {
		t.Fatalf("expected 2 devices, got %d", len(result))
	}
	if result[0].Device != "wg0" || result[1].Device != "wg1" {
		t.Errorf("wrong device order: %s, %s", result[0].Device, result[1].Device)
	}
	if len(result[0].Peers) != 1 || len(result[1].Peers) != 1 {
		t.Errorf("expected 1 peer per device")
	}
}

func TestParseWgShowDump_HandshakeFormatUTC(t *testing.T) {
	// epoch 0 = zero time
	input := "wg0\tpk\tpub\t51820\toff\n" +
		"wg0\tPEER\t(none)\t(none)\t(none)\t0\t0\t0\t0"
	result := parseWgShowDump(input)
	if result[0].Peers[0].LatestHandshake != "0001-01-01 00:00:00" {
		t.Errorf("expected zero-time for epoch 0")
	}

	// Specific epoch → must format as UTC
	epoch := int64(1700000000) // 2023-11-14 22:13:20 UTC
	input2 := "wg0\tpk\tpub\t51820\toff\n" +
		"wg0\tPEER\t(none)\t(none)\t(none)\t" + itoa(epoch) + "\t0\t0\t0"
	result2 := parseWgShowDump(input2)
	want := time.Unix(epoch, 0).UTC().Format("2006-01-02 15:04:05")
	if result2[0].Peers[0].LatestHandshake != want {
		t.Errorf("expected %s, got %s", want, result2[0].Peers[0].LatestHandshake)
	}
}

func TestParseWgShowDump_SkipsGarbageLines(t *testing.T) {
	input := "this is not valid\n" +
		"wg0\tpk\tpub\t51820\toff\n" +
		"also bad\n" +
		"wg0\tPEER\t(none)\t(none)\t(none)\t0\t0\t0\t0"
	result := parseWgShowDump(input)
	if len(result) != 1 {
		t.Fatalf("expected 1 device, got %d", len(result))
	}
	if len(result[0].Peers) != 1 {
		t.Errorf("expected 1 peer, got %d", len(result[0].Peers))
	}
}

func itoa(n int64) string {
	return strconv.FormatInt(n, 10)
}
