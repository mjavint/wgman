package handler

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
)

func joinStringSlice(s []string) string {
	return strings.Join(s, ",")
}

func splitString(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, ",")
}

func generateClientID() string {
	b := make([]byte, 10)
	rand.Read(b)
	return "c" + hex.EncodeToString(b)
}
