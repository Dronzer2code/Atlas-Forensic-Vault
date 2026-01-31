import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      badgeId: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: string;
    badgeId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    badgeId: string;
  }
}
