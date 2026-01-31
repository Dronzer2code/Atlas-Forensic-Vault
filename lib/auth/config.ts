import { NextAuthOptions } from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

// MongoDB client for NextAuth adapter
const uri = process.env.MONGODB_URI!;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromiseAuth: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromiseAuth) {
    client = new MongoClient(uri, options);
    global._mongoClientPromiseAuth = client.connect();
  }
  clientPromise = global._mongoClientPromiseAuth;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export { clientPromise };

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise, {
    databaseName: process.env.DB_NAME || "repo-podcast",
  }),
  providers: [
    CredentialsProvider({
      name: "Badge Credentials",
      credentials: {
        badgeId: { label: "Badge ID", type: "text" },
        securityCode: { label: "Security Code", type: "password" },
        isSignUp: { label: "Sign Up Mode", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.badgeId || !credentials?.securityCode) {
          return null;
        }

        const client = await clientPromise;
        const db = client.db(process.env.DB_NAME || "repo-podcast");
        const usersCollection = db.collection("users");
        const isSignUp = credentials.isSignUp === "true";

        // Find user by badgeId (stored as email for compatibility)
        const user = await usersCollection.findOne({
          $or: [
            { email: credentials.badgeId },
            { badgeId: credentials.badgeId },
          ],
        });

        if (isSignUp) {
          // Sign up mode - create new account
          if (user) {
            // User already exists - cannot sign up
            throw new Error("BADGE_EXISTS");
          }

          const hashedPassword = await bcrypt.hash(credentials.securityCode, 12);
          const newUser = {
            badgeId: credentials.badgeId,
            email: credentials.badgeId,
            name: `Investigator ${credentials.badgeId.toUpperCase()}`,
            password: hashedPassword,
            image: null,
            role: "investigator",
            investigations: [],
            monthlyInvestigationCount: 0,
            lastResetDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const result = await usersCollection.insertOne(newUser);
          return {
            id: result.insertedId.toString(),
            email: newUser.email,
            name: newUser.name,
            badgeId: newUser.badgeId,
            role: newUser.role,
          };
        }

        // Login mode - verify existing account
        if (!user) {
          // User doesn't exist
          throw new Error("INVALID_CREDENTIALS");
        }

        // Verify password
        const isValid = await bcrypt.compare(
          credentials.securityCode,
          user.password
        );

        if (!isValid) {
          throw new Error("INVALID_CREDENTIALS");
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          badgeId: user.badgeId || user.email,
          role: user.role || "investigator",
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role || "investigator";
        token.badgeId = (user as { badgeId?: string }).badgeId || user.email || "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.badgeId = token.badgeId;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Handle callback URL for investigation redirect
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
