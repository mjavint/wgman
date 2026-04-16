package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// APIResponse is the standard JSON envelope for all REST API endpoints.
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// JSONResponse writes a successful APIResponse with optional data.
func JSONResponse(c echo.Context, status bool, data interface{}, msg string) error {
	resp := APIResponse{Success: status, Data: data}
	if !status && msg != "" {
		resp.Message = msg
	}
	return c.JSON(http.StatusOK, resp)
}

// APIError writes a failed APIResponse with an HTTP status code.
func APIError(c echo.Context, code int, err string) error {
	return c.JSON(code, APIResponse{Success: false, Error: err})
}
