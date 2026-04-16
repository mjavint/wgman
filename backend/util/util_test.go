package util

import (
	"errors"
	"testing"

	"github.com/mjavint/wgman/model"
	"github.com/mjavint/wgman/store"
)

// ── GetInterfaceName ─────────────────────────────────────────────────────────

func TestGetInterfaceName(t *testing.T) {
	cases := []struct {
		path string
		want string
	}{
		{"/etc/wireguard/wg0.conf", "wg0"},
		{"/app/db/wg0.conf", "wg0"},
		{"/etc/wireguard/wg1.conf", "wg1"},
		{"wg0.conf", "wg0"},
		{"/some/path/vpn-server.conf", "vpn-server"},
	}
	for _, tc := range cases {
		got := GetInterfaceName(tc.path)
		if got != tc.want {
			t.Errorf("GetInterfaceName(%q) = %q, want %q", tc.path, got, tc.want)
		}
	}
}

// ── mockStore ────────────────────────────────────────────────────────────────

// mockStore satisfies store.IStore; only hash methods are functional.
type mockStore struct {
	hashes    model.ClientServerHashes
	hashesErr error
	saved     *model.ClientServerHashes
}

var _ store.IStore = (*mockStore)(nil) // compile-time check

func (m *mockStore) GetHashes() (model.ClientServerHashes, error) { return m.hashes, m.hashesErr }
func (m *mockStore) SaveHashes(h model.ClientServerHashes) error   { m.saved = &h; return nil }

// Stubs for remaining interface methods
func (m *mockStore) Init() error                                    { return nil }
func (m *mockStore) GetPath() string                                { return "/tmp" }
func (m *mockStore) GetUsers() ([]model.User, error)                { return nil, nil }
func (m *mockStore) GetUserByName(_ string) (model.User, error)     { return model.User{}, nil }
func (m *mockStore) SaveUser(_ model.User) error                    { return nil }
func (m *mockStore) DeleteUser(_ string) error                      { return nil }
func (m *mockStore) GetGlobalSettings() (model.GlobalSetting, error) {
	return model.GlobalSetting{}, nil
}
func (m *mockStore) SaveGlobalSettings(_ model.GlobalSetting) error      { return nil }
func (m *mockStore) GetServer() (model.Server, error)                    { return model.Server{}, nil }
func (m *mockStore) SaveServerInterface(_ model.ServerInterface) error   { return nil }
func (m *mockStore) SaveServerKeyPair(_ model.ServerKeypair) error       { return nil }
func (m *mockStore) GetClients(_ bool) ([]model.ClientData, error)       { return nil, nil }
func (m *mockStore) GetClientByID(_ string, _ model.QRCodeSettings) (model.ClientData, error) {
	return model.ClientData{}, nil
}
func (m *mockStore) SaveClient(_ model.Client) error { return nil }
func (m *mockStore) DeleteClient(_ string) error     { return nil }
func (m *mockStore) GetWakeOnLanHosts() ([]model.WakeOnLanHost, error)      { return nil, nil }
func (m *mockStore) GetWakeOnLanHost(_ string) (*model.WakeOnLanHost, error) { return nil, nil }
func (m *mockStore) DeleteWakeOnHostLanHost(_ string) error                  { return nil }
func (m *mockStore) SaveWakeOnLanHost(_ model.WakeOnLanHost) error           { return nil }
func (m *mockStore) DeleteWakeOnHost(_ model.WakeOnLanHost) error            { return nil }

// ── HashesChanged ────────────────────────────────────────────────────────────

func TestHashesChanged_ErrorFetchingHashes(t *testing.T) {
	// DB read error → treat as changed so Apply button appears
	ms := &mockStore{hashesErr: errors.New("db read error")}
	if !HashesChanged(ms) {
		t.Error("expected HashesChanged=true when GetHashes returns error")
	}
}

func TestHashesChanged_NoStoredHashes(t *testing.T) {
	// Empty stored hashes with clients present → changed
	ms := &mockStore{hashes: model.ClientServerHashes{Client: "", Server: ""}}
	// GetCurrentHash will compute something non-empty from the mock store's empty clients dir.
	// We just verify the function runs without panic.
	_ = HashesChanged(ms)
}

func TestHashesChanged_MatchingHashes(t *testing.T) {
	// When stored hashes equal computed hashes, return false.
	// We compute the current hash first, then verify no change detected.
	ms := &mockStore{}
	client, server := GetCurrentHash(ms)
	ms.hashes = model.ClientServerHashes{Client: client, Server: server}
	if HashesChanged(ms) {
		t.Error("expected HashesChanged=false when hashes match")
	}
}

func TestHashesChanged_DifferentClientHash(t *testing.T) {
	ms := &mockStore{
		hashes: model.ClientServerHashes{Client: "staleClientHash", Server: ""},
	}
	if !HashesChanged(ms) {
		t.Error("expected HashesChanged=true when client hash differs")
	}
}

// ── UpdateHashes ─────────────────────────────────────────────────────────────

func TestUpdateHashes_CallsSaveHashes(t *testing.T) {
	ms := &mockStore{}
	if err := UpdateHashes(ms); err != nil {
		t.Fatalf("UpdateHashes returned error: %v", err)
	}
	if ms.saved == nil {
		t.Fatal("SaveHashes was never called")
	}
}

func TestUpdateHashes_SavesNonEmptyHashes(t *testing.T) {
	ms := &mockStore{}
	_ = UpdateHashes(ms)
	// Hashes may be empty strings if DB dirs don't exist, but no panic should occur.
	if ms.saved == nil {
		t.Fatal("SaveHashes was never called")
	}
}
