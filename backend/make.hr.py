
from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()

try:
    email = input("Enter your registered email: ").strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if user is None:
        print("User not found. Check your email.")
    else:
        user.role = "HR"
        db.commit()
        db.refresh(user)

        print("Role updated successfully!")
        print("Name:", user.full_name)
        print("Email:", user.email)
        print("Role:", user.role)

finally:
    db.close()
