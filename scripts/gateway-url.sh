#!/bin/bash
# SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
# Copyright (C) 2006-2026 DIY Accounting Limited
#
# Print the gateway URL for the environment named in ENVIRONMENT_NAME (ci or prod).
set -euo pipefail

case "${ENVIRONMENT_NAME:?Set ENVIRONMENT_NAME to ci or prod}" in
  prod) echo "https://diyaccounting.co.uk" ;;
  ci) echo "https://ci-gateway.diyaccounting.co.uk" ;;
  *) echo "ENVIRONMENT_NAME must be ci or prod" >&2; exit 1 ;;
esac
