import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

try {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "lucia" } },
        { name: { contains: "lucia" } },
        { name: { contains: "Malinowski" } },
        { email: { contains: "malinowski" } }
      ]
    },
    orderBy: { createdAt: "desc" }
  });
  console.log("LUCIA_USERS", JSON.stringify(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, status: u.status }))));

  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
  console.log("CLIENTS", JSON.stringify(clients.map(c => ({ id: c.id, name: c.name, status: c.status }))));

  const members = await prisma.clientMember.findMany({
    include: {
      user: { select: { id: true, email: true, name: true, role: true, status: true } },
      client: { select: { id: true, name: true, status: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  console.log("MEMBERSHIPS", JSON.stringify(members.map(m => ({ memberId: m.id, userId: m.userId, clientId: m.clientId, role: m.role, user: m.user, client: m.client }))));

} catch (e) {
  console.error("QUERY_ERROR", e.message);
  process.exit(2);
} finally {
  await prisma.$disconnect();
}
