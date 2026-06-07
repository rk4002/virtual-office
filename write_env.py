#!/usr/bin/env python3
secret = "dc9997...\n"
lines = [
    "# VirtualOffice — NextAuth.js + Azure AD Configuration",
    "# ============================================================",
    "",
    "# Trin 1: NEXTAUTH_SECRET (genereret med openssl rand -hex 32)",
    f"NEXTAUTH_SECRET=***    "",
    "# Trin 2: Azure AD App Registration credentials",
    "# Rasmus (rka@2care4.dk): Opret app registration i 2care4s M365 tenant",
    "# Gaa til Azure Portal > App Registrations > New Registration",
    "# Efter oprettelse: Udfyld disse tre vaerdier fra Overview siden:",
    "AZURE_AD_CLIENT_ID=",
    "AZURE_AD_CLIENT_SECRET=***    "AZURE_AD_TENANT_ID=",
    "",
    "# Trin 3: NextAuth URL (auto-detekteret i dev, kraeves i production)",
    "NEXTAUTH_URL=http:/...    "",
    "# Session strategy: JWT (ingen database kraevet til MVP)",
]

path = "/Users/bh32_mac_mini/projects/virtual-office/.env.local"
with open(path, "w") as f:
    f.write("\n".join(lines) + "\n")
print(f"Written {len(lines)} lines to {path}")