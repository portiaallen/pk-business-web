CREATE TABLE IF NOT EXISTS "InventoryMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'STAFF',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InventoryMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryMember_clientId_userId_key" ON "InventoryMember"("clientId", "userId");
CREATE INDEX IF NOT EXISTS "InventoryMember_clientId_idx" ON "InventoryMember"("clientId");
CREATE INDEX IF NOT EXISTS "InventoryMember_userId_idx" ON "InventoryMember"("userId");

CREATE TABLE IF NOT EXISTS "InventoryLocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InventoryLocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryLocation_clientId_name_key" ON "InventoryLocation"("clientId", "name");
CREATE INDEX IF NOT EXISTS "InventoryLocation_clientId_idx" ON "InventoryLocation"("clientId");
CREATE INDEX IF NOT EXISTS "InventoryLocation_isActive_idx" ON "InventoryLocation"("isActive");

CREATE TABLE IF NOT EXISTS "InventoryProduct" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'each',
  "currentQuantity" INTEGER NOT NULL DEFAULT 0,
  "reorderThreshold" INTEGER NOT NULL DEFAULT 0,
  "locationId" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InventoryProduct_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryProduct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryProduct_clientId_sku_key" ON "InventoryProduct"("clientId", "sku");
CREATE INDEX IF NOT EXISTS "InventoryProduct_clientId_idx" ON "InventoryProduct"("clientId");
CREATE INDEX IF NOT EXISTS "InventoryProduct_locationId_idx" ON "InventoryProduct"("locationId");
CREATE INDEX IF NOT EXISTS "InventoryProduct_isActive_idx" ON "InventoryProduct"("isActive");
CREATE INDEX IF NOT EXISTS "InventoryProduct_category_idx" ON "InventoryProduct"("category");

CREATE TABLE IF NOT EXISTS "InventoryTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "transactionType" TEXT NOT NULL,
  "quantityChange" INTEGER NOT NULL,
  "quantityBefore" INTEGER NOT NULL,
  "quantityAfter" INTEGER NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "performedById" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryTransaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "InventoryTransaction_clientId_idx" ON "InventoryTransaction"("clientId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_productId_idx" ON "InventoryTransaction"("productId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_performedById_idx" ON "InventoryTransaction"("performedById");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_transactionType_idx" ON "InventoryTransaction"("transactionType");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");
