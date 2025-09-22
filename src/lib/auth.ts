import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { Role } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email & Lösenord",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Lösenord", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: creds.email } });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        if (!ok) return null;

        // returnera roll direkt
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // vid inloggning
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role as Role;
      }
      // fallback: om token saknar role (t.ex. efter server-restart), hämta från DB
      if (!token.role && token.sub) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
        token.role = (dbUser?.role ?? Role.SALJARE) as Role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.uid) (session.user as any).id = token.uid as string;
      (session.user as any).role = (token as any).role ?? Role.SALJARE;
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};
