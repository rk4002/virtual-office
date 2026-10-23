import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";

// LOCAL_LOGIN=true: kør uden Microsoft-login. Brugeren logges ind automatisk
// som LOCAL_USER_NAME via /api/local-login. Til lokal brug paa eget net —
// aldrig paa en offentlig deployment.
export const localLogin = process.env.LOCAL_LOGIN === "true";

const providers: Provider[] = [];

if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: {
        params: {
          scope: "openid profile email OnlineMeetings.ReadWrite",
        },
      },
    })
  );
}

if (localLogin) {
  providers.push(
    Credentials({
      id: "local",
      name: "Lokal",
      credentials: {},
      async authorize() {
        const name = process.env.LOCAL_USER_NAME || "Rasmus";
        return {
          id: "local-" + name.toLowerCase(),
          name,
          email: process.env.LOCAL_USER_EMAIL || "",
        };
      },
    })
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  session: {
    strategy: "jwt",
    // Lokalt: hold dig logget ind i 30 dage, ellers 8 timer
    maxAge: localLogin ? 30 * 24 * 60 * 60 : 8 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Store Entra ID claims on first sign-in
      if (account && profile) {
        token.id = profile.sub ?? token.sub;
        token.email = profile.email;
        token.name = profile.name;
        // Store tenant ID for multi-tenant support later
        token.tid = (profile as Record<string, unknown>).tid;
        // Store access token for Graph API calls (Teams meetings)
        token.accessToken = account.access_token;
      } else if (account?.provider === "local" && user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub ?? "") as string;
        session.user.email = (token.email ?? "") as string;
        session.user.name = (token.name ?? "") as string;
      }
      // Pass access token for Graph API calls
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
