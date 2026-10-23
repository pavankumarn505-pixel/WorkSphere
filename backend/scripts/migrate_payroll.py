
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "worksphere.db"


def migrate():
    connection = sqlite3.connect(DB_PATH)

    try:
        connection.execute("BEGIN")

        columns = {
            row[1]
            for row in connection.execute(
                "PRAGMA table_info(payroll)"
            ).fetchall()
        }

        if not columns:
            raise RuntimeError(
                "The payroll table does not exist. Migration stopped."
            )

        if "allowances" not in columns:
            connection.execute(
                """
                ALTER TABLE payroll
                ADD COLUMN allowances NUMERIC(12, 2)
                NOT NULL DEFAULT 0
                """
            )

        if "gross_salary" not in columns:
            connection.execute(
                """
                ALTER TABLE payroll
                ADD COLUMN gross_salary NUMERIC(12, 2)
                NOT NULL DEFAULT 0
                """
            )

        connection.execute(
            """
            UPDATE payroll
            SET gross_salary = basic_salary + allowances + bonus,
                net_salary = basic_salary + allowances + bonus - deductions
            """
        )

        connection.commit()

        print("Payroll migration completed successfully.")
        print("Columns:", [
            row[1]
            for row in connection.execute(
                "PRAGMA table_info(payroll)"
            ).fetchall()
        ])

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


if __name__ == "__main__":
    migrate()
