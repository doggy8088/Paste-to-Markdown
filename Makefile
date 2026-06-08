.DEFAULT_GOAL := serve

SHELL := /bin/bash

PORT ?= 5500
HOST ?= 127.0.0.1
URL := http://$(HOST):$(PORT)/index.html
PYTHON ?= python3

SERVER_PID_FILE := .make/server.pid
SERVER_LOG_FILE := .make/server.log

JS_FILES := assets/clipboard2markdown.js assets/to-markdown.js

.PHONY: help serve server serve-bg stop open status check test clean restart

help:
	@echo "Paste to Markdown - Makefile tasks"
	@echo ""
	@echo "  make            啟動本機伺服器並自動開啟網頁（預設）"
	@echo "  make help       查看可用指令"
	@echo "  make serve      啟動本機伺服器（前景）並自動開啟網頁"
	@echo "  make server     同 make serve"
	@echo "  make serve-bg   啟動本機伺服器（背景）"
	@echo "  make stop       停止背景伺服器"
	@echo "  make open       開啟本機網址"
	@echo "  make status     顯示背景伺服器狀態"
	@echo "  make check      檢查 JS 語法"
	@echo "  make test       執行快速本機健康檢查"
	@echo "  make clean      清除本機服務啟動檔案"
	@echo "  make restart    重啟背景伺服器"
	@echo ""
	@echo "可覆寫參數:"
	@echo "  make serve HOST=0.0.0.0 PORT=8000"

serve:
	@command -v $(PYTHON) >/dev/null 2>&1 || { echo "找不到 $(PYTHON)"; exit 1; }
	@echo "開啟本機測試伺服器：$(URL)"
	-@(sleep 1 && $(MAKE) open) &
	@$(PYTHON) -m http.server $(PORT) --bind $(HOST)

server: serve

serve-bg:
	@mkdir -p .make
	@command -v $(PYTHON) >/dev/null 2>&1 || { echo "找不到 $(PYTHON)"; exit 1; }
	@if [ -f "$(SERVER_PID_FILE)" ]; then \
		EXISTING_PID=$$(cat "$(SERVER_PID_FILE)"); \
		if ps -p "$$EXISTING_PID" >/dev/null 2>&1; then \
			echo "背景伺服器已在執行中 (PID $$EXISTING_PID)"; \
			exit 1; \
		fi \
	fi
	@nohup $(PYTHON) -m http.server $(PORT) --bind $(HOST) >"$(SERVER_LOG_FILE)" 2>&1 & \
		echo "$$!" > "$(SERVER_PID_FILE)"; \
		echo "背景伺服器已啟動: $(URL)"; \
		echo "PID: $$(cat $(SERVER_PID_FILE))"; \
		echo "Log: $(SERVER_LOG_FILE)"

stop:
	@if [ -f "$(SERVER_PID_FILE)" ]; then \
		PID=$$(cat "$(SERVER_PID_FILE)"); \
		if ps -p "$$PID" >/dev/null 2>&1; then \
			kill "$$PID"; \
			rm -f "$(SERVER_PID_FILE)"; \
			echo "已停止背景伺服器 (PID $$PID)"; \
		else \
			echo "背景伺服器未在執行 (孤立 PID 檔案)"; \
			rm -f "$(SERVER_PID_FILE)"; \
		fi \
	else \
		echo "未找到背景伺服器 PID 檔案"; \
	fi

open:
	@if command -v open >/dev/null 2>&1; then \
		open "$(URL)"; \
		echo "已用 open 開啟 $(URL)"; \
	elif command -v xdg-open >/dev/null 2>&1; then \
		xdg-open "$(URL)"; \
		echo "已用 xdg-open 開啟 $(URL)"; \
	else \
		echo "請手動開啟：$(URL)"; \
	fi

status:
	@if [ -f "$(SERVER_PID_FILE)" ]; then \
		PID=$$(cat "$(SERVER_PID_FILE)"); \
		if ps -p "$$PID" >/dev/null 2>&1; then \
			echo "背景伺服器執行中: PID $$PID"; \
			echo "位址: $(URL)"; \
		else \
			echo "背景伺服器未啟動"; \
		fi \
	else \
		echo "背景伺服器未啟動"; \
	fi

check:
	@node --check $(JS_FILES)

# 目前專案無自動化測試框架
# 這裡保留 test 任務，方便日後接入
# 並提供最小一致的快速驗證流程
test: check
	@echo "目前沒有自動化測試，請用 make serve 開啟本機後手動驗證（貼上來源與預覽輸出）。"

clean:
	@rm -rf .make
	@echo "已清除本機服務檔案"

restart: stop serve-bg
