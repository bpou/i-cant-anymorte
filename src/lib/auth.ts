import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { authenticator } from "otplib";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  isEncryptedTotpSecret,
} from "@/lib/totp-secrets";

authenticator.options = { window: 1 };

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email & Losenord",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Losenord", type: "password" },
        otp: { label: "Engangskod", type: "text" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;

        const user = await prisma.user.findUnique({ where: { email: creds.email } });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        if (!ok) return null;

        let totpSecret: string | null = null;
        try {
          totpSecret = decryptTotpSecret(user.totpSecret);
        } catch (error) {
          console.error("Failed to decrypt stored TOTP secret", error);
          throw new Error("MFA_UNAVAILABLE");
        }

        if (user.totpSecret && !isEncryptedTotpSecret(user.totpSecret) && totpSecret) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { totpSecret: encryptTotpSecret(totpSecret) },
            });
          } catch (error) {
            console.error("Failed to re-encrypt TOTP secret during login", error);
            throw new Error("MFA_UNAVAILABLE");
          }
        }

        const requiresTotp = Boolean(user.totpEnabled && totpSecret);
        const otp = typeof creds.otp === "string" ? creds.otp.trim() : "";

        if (requiresTotp) {
          if (!otp) {
            throw new Error("MFA_REQUIRED");
          }
          const otpValid = authenticator.verify({ token: otp, secret: totpSecret! });
          if (!otpValid) {
            throw new Error("INVALID_OTP");
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          totpEnabled: user.totpEnabled,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role as Role;
        (token as any).mfaEnabled = Boolean((user as any).totpEnabled);
        return token;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, totpEnabled: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          (token as any).mfaEnabled = dbUser.totpEnabled;
        }
      }

      if (!token.role) token.role = Role.SALJARE;
      if (typeof (token as any).mfaEnabled === "undefined") {
        (token as any).mfaEnabled = false;
      }

      return token;
    },
    async session({ session, token }) {
      if (token?.uid) (session.user as any).id = token.uid as string;
      (session.user as any).role = (token as any).role ?? Role.SALJARE;
      (session.user as any).mfaEnabled = Boolean((token as any).mfaEnabled);
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};

