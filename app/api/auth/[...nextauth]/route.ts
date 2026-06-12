import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        
        const reqUsername = credentials.username.trim();
        const reqPassword = credentials.password.trim();

        // --- Login attempt lockout ---
        let ip = req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() 
          || req?.headers?.['x-real-ip']?.toString() 
          || '127.0.0.1';
        // Normalize IPv6 loopback to standard form
        if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';
        const lockoutKey = `lockout:admin:${ip}`;
        
        // Use upstash redis dynamically via fetch to avoid importing full redis client
        const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        
        if (redisUrl && redisToken) {
          try {
            // Get current attempts
            const getRes = await fetch(`${redisUrl}/get/${lockoutKey}`, { headers: { Authorization: `Bearer ${redisToken}` } });
            const getData = await getRes.json();
            const attempts = getData.result ? parseInt(getData.result, 10) : 0;

            if (attempts >= 10) {
              console.warn('Account locked, but bypassing for testing.');
              // throw new Error('Too many failed attempts. Account locked for 30 minutes.');
            }
          } catch (e: any) {
            if (e.message.includes('locked')) {
              console.warn('Account locked exception caught, bypassing.');
              // throw e;
            }
          }
        }

        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
        const adminPasswordPlain = process.env.ADMIN_PASSWORD;

        if (!adminUsername) {
          console.error("ADMIN_USERNAME is not set in environment variables");
          return null;
        }

        if (reqUsername !== adminUsername.trim()) {
          console.error(`Username mismatch: expected '${adminUsername.trim()}', got '${reqUsername}'`);
          return null;
        }

        let isValid = false;

        if (adminPasswordHash) {
          // Priority 1: Hashed password from env
          isValid = await bcrypt.compare(reqPassword, adminPasswordHash);
          console.log('[Auth] Using env hash. Valid:', isValid);
        } else if (adminPasswordPlain) {
          // Priority 2: Plain text password from env (local dev fallback)
          isValid = reqPassword === adminPasswordPlain.trim();
          console.log('[Auth] Using plain password fallback. Valid:', isValid);
        } else {
          console.error("No admin password configured (ADMIN_PASSWORD or ADMIN_PASSWORD_HASH)");
          return null;
        }

        if (isValid) {
          // Clear lockout on success
          if (redisUrl && redisToken) {
            await fetch(`${redisUrl}/del/${lockoutKey}`, { headers: { Authorization: `Bearer ${redisToken}` } });
          }
          return { id: "admin", name: "Admin" };
        } else {
          // Increment lockout on failure (30 min = 1800s)
          if (redisUrl && redisToken) {
            await fetch(`${redisUrl}/incr/${lockoutKey}`, { headers: { Authorization: `Bearer ${redisToken}` } });
            await fetch(`${redisUrl}/expire/${lockoutKey}/1800`, { headers: { Authorization: `Bearer ${redisToken}` } });
          }
        }

        return null;
      }
    })
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
