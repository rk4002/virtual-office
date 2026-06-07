import os

secret = "dc999724be2857251191c346919fdc19426395252bf1837b5168573eb8f1791a"
url = "http://localhost:3000"

env = f"""# VirtualOffice - NextAuth.js + Azure AD Configuration
# ============================================================

# Trin 1: NEXTAUTH_SECRET
NEXTAUTH_SECRET=***# Trin 2: Azure AD App Registration credentials (udfyldes af Rasmus)
# Gaa til Azure Portal > App Registrations > New Registration

AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=***AZURE_AD_TENANT_ID=

# Trin 3: NextAuth URL
NEXTAUTH_URL={url}
"""

target = "/Users/bh32_mac_mini/projects/virtual-office/.env.local"
with open(target, "w") as f:
    f.write(env)

print(f"Written {len(env)} bytes to {target}")
# Verify
with open(target) as f:
    print(f.read())