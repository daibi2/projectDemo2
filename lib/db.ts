import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

export function initializeDatabase(db: SqliteDatabase) {
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      total_spots INTEGER NOT NULL CHECK (total_spots > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parking_spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
      number TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'RESERVATION_LOCKED')),
      UNIQUE(lot_id, number)
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plate_number TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('TEMPORARY', 'MONTHLY', 'RESERVATION')),
      UNIQUE(owner_id, plate_number)
    );

    CREATE TABLE IF NOT EXISTS parking_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lot_id INTEGER NOT NULL REFERENCES lots(id),
      spot_id INTEGER NOT NULL REFERENCES parking_spots(id),
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      fee_cents INTEGER,
      status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
      CHECK (
        (status = 'IN_PROGRESS' AND exit_time IS NULL AND fee_cents IS NULL) OR
        (status = 'COMPLETED' AND exit_time IS NOT NULL AND fee_cents IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS one_active_record_per_vehicle
      ON parking_records(owner_id, vehicle_id)
      WHERE status = 'IN_PROGRESS';
    CREATE INDEX IF NOT EXISTS lots_by_owner ON lots(owner_id);
    CREATE INDEX IF NOT EXISTS spots_by_lot_status ON parking_spots(lot_id, status);
    CREATE INDEX IF NOT EXISTS records_by_owner_status ON parking_records(owner_id, status);
  `);
}

let database: SqliteDatabase | undefined;

export function getDb() {
  if (!database) {
    database = new Database(process.env.DATABASE_URL ?? "./parking.db");
    initializeDatabase(database);
  }
  return database;
}
