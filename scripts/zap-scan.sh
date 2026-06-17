#!/bin/bash

# =============================================================================
# OWASP ZAP Security Scan Scripts for Nabeeh
# =============================================================================
# Usage:
#   ./scripts/zap-scan.sh baseline    # Fast passive scan (~5 min)
#   ./scripts/zap-scan.sh full        # Full active scan (~30-60 min)
#   ./scripts/zap-scan.sh api         # API-specific scan (~15-30 min)
#   ./scripts/zap-scan.sh all         # Run all scans sequentially
#   ./scripts/zap-scan.sh stop        # Stop all ZAP containers
#   ./scripts/zap-scan.sh reports     # Show report locations
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_DIR/zap/reports"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Check if services are running
check_services() {
    if ! docker compose -f "$COMPOSE_FILE" ps backend | grep -q "Up"; then
        log_warn "Backend service is not running. Starting services..."
        docker compose -f "$COMPOSE_FILE" up -d backend frontend
        sleep 10
    fi
}

# Wait for services to be healthy
wait_for_healthy() {
    local service=$1
    local max_wait=60
    local wait_time=0

    log_info "Waiting for $service to be healthy..."
    while [ $wait_time -lt $max_wait ]; do
        if docker compose -f "$COMPOSE_FILE" ps $service | grep -q "healthy"; then
            log_success "$service is healthy"
            return 0
        fi
        sleep 5
        wait_time=$((wait_time + 5))
    done

    log_error "$service did not become healthy within ${max_wait}s"
    return 1
}

# Run baseline scan (passive, fast)
run_baseline() {
    log_info "Starting ZAP Baseline Scan..."
    log_info "This is a passive scan that checks for common vulnerabilities without attacking the application."
    log_info "Estimated time: ~5-10 minutes"

    docker compose -f "$COMPOSE_FILE" up zap-baseline

    log_success "Baseline scan complete!"
    log_info "Reports saved to: $REPORTS_DIR/"
}

# Run full scan (active, thorough)
run_full() {
    log_info "Starting ZAP Full Scan..."
    log_info "This is an active scan that attempts to exploit vulnerabilities."
    log_info "Estimated time: ~30-60 minutes"

    docker compose -f "$COMPOSE_FILE" up zap-full

    log_success "Full scan complete!"
    log_info "Reports saved to: $REPORTS_DIR/"
}

# Run API scan
run_api() {
    log_info "Starting ZAP API Scan..."
    log_info "This scans the API endpoints using the OpenAPI specification."
    log_info "Estimated time: ~15-30 minutes"

    docker compose -f "$COMPOSE_FILE" up zap-api

    log_success "API scan complete!"
    log_info "Reports saved to: $REPORTS_DIR/"
}

# Run all scans
run_all() {
    log_info "Running all ZAP scans sequentially..."
    run_baseline
    run_api
    run_full
    log_success "All scans complete!"
}

# Stop all ZAP containers
stop_zap() {
    log_info "Stopping all ZAP containers..."
    docker compose -f "$COMPOSE_FILE" stop zap-baseline zap-full zap-api
    log_success "All ZAP containers stopped."
}

# Show report locations
show_reports() {
    log_info "ZAP Scan Reports:"
    echo ""
    if [ -d "$REPORTS_DIR" ]; then
        ls -la "$REPORTS_DIR/" 2>/dev/null || echo "No reports found."
    else
        echo "No reports directory found. Run a scan first."
    fi
    echo ""
    log_info "To view HTML reports, open them in a browser."
    log_info "To view JSON reports, use: cat <report-file>.json | jq ."
}

# Main function
main() {
    check_docker

    case "${1:-help}" in
        baseline)
            check_services
            wait_for_healthy "backend"
            wait_for_healthy "frontend"
            run_baseline
            ;;
        full)
            check_services
            wait_for_healthy "backend"
            wait_for_healthy "frontend"
            run_full
            ;;
        api)
            check_services
            wait_for_healthy "backend"
            run_api
            ;;
        all)
            check_services
            wait_for_healthy "backend"
            wait_for_healthy "frontend"
            run_all
            ;;
        stop)
            stop_zap
            ;;
        reports)
            show_reports
            ;;
        help|*)
            echo ""
            echo "OWASP ZAP Security Scan Scripts for Nabeeh"
            echo ""
            echo "Usage: $0 {baseline|full|api|all|stop|reports|help}"
            echo ""
            echo "Commands:"
            echo "  baseline  - Run passive baseline scan (fast, ~5 min)"
            echo "  full      - Run full active scan (thorough, ~30-60 min)"
            echo "  api       - Run API-specific scan (~15-30 min)"
            echo "  all       - Run all scans sequentially"
            echo "  stop      - Stop all ZAP containers"
            echo "  reports   - Show report file locations"
            echo "  help      - Show this help message"
            echo ""
            echo "Reports are saved to: $REPORTS_DIR/"
            echo ""
            ;;
    esac
}

main "$@"
