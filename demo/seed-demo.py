#!/usr/bin/env python3
"""
VirtualOffice — Demo seed runner (Python wrapper)
=================================================
Kør: python seed-demo.py

Kræver:
  - POSTGRES_URL sat i .env.local (eller som environment variabel)
  - pip install psycopg2-binary python-dotenv

Alternativ med psql:
  export $(grep POSTGRES_URL /Users/bh32_mac_mini/projects/virtual-office/.env.local | xargs)
  psql "$POSTGRES_URL" -f seed-demo-users.sql
"""

import os
import sys
from pathlib import Path

def main():
    # Forsøg at læse .env.local
    env_file = Path("/Users/bh32_mac_mini/projects/virtual-office/.env.local")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                if k.strip() and v.strip():
                    os.environ.setdefault(k.strip(), v.strip())

    db_url = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not db_url:
        print("FEJL: Ingen POSTGRES_URL fundet.")
        print("Sæt POSTGRES_URL i .env.local eller som environment variabel.")
        print("Se DEPLOY.md for Vercel Postgres opsætning.")
        sys.exit(1)

    try:
        import psycopg2
    except ImportError:
        print("FEJL: psycopg2 ikke installeret.")
        print("Kør: pip install psycopg2-binary")
        sys.exit(1)

    sql_file = Path(__file__).parent / "seed-demo-users.sql"
    if not sql_file.exists():
        print(f"FEJL: {sql_file} ikke fundet.")
        sys.exit(1)

    print("Forbinder til Vercel Postgres...")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = False
        cur = conn.cursor()

        sql = sql_file.read_text()
        # Kør statement for statement (skip tomme)
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        for stmt in statements:
            if stmt.upper().startswith("SELECT"):
                cur.execute(stmt)
                rows = cur.fetchall()
                for row in rows:
                    print(" ".join(str(c) for c in row))
            else:
                cur.execute(stmt)

        conn.commit()
        print("\nDemo-data seedet succesfuldt!")
        print("7 brugere online, demo-layout oprettet, 5 chat-beskeder.")

    except Exception as e:
        print(f"FEJL: {e}")
        if 'conn' in dir():
            conn.rollback()
        sys.exit(1)
    finally:
        if 'cur' in dir():
            cur.close()
        if 'conn' in dir():
            conn.close()

if __name__ == "__main__":
    main()
