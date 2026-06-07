// VirtualOffice — NextAuth type augmentation
// Adds accessToken to the Session type for Microsoft Graph API calls.

import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}