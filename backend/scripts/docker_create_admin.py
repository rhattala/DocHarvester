#!/usr/bin/env python3
"""
Create default admin user for DocHarvester - Docker version
This script is designed to run inside the Docker container
"""
import asyncio
import os
import sys

# Add the backend directory to Python path
sys.path.insert(0, '/app/backend')

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import AsyncSessionLocal
from backend.models import User
from backend.api.auth import get_password_hash

DEFAULT_ADMIN_EMAIL = "admin@docharvester.com"
DEFAULT_ADMIN_PASSWORD = "admin123"

async def create_admin_user():
    """Create or reset the default admin user"""
    try:
        async with AsyncSessionLocal() as session:
            # Check if admin user exists
            result = await session.execute(
                text("SELECT id FROM users WHERE email = :email"),
                {"email": DEFAULT_ADMIN_EMAIL}
            )
            admin = result.scalar_one_or_none()
            
            if admin:
                print(f"✅ Admin user '{DEFAULT_ADMIN_EMAIL}' already exists.")
                
                # Update password and ensure admin flag is set
                await session.execute(
                    text("UPDATE users SET hashed_password = :password, is_admin = true WHERE email = :email"),
                    {
                        "password": get_password_hash(DEFAULT_ADMIN_PASSWORD),
                        "email": DEFAULT_ADMIN_EMAIL
                    }
                )
                await session.commit()
                print("🔄 Admin password has been reset and admin privileges ensured.")
            else:
                # Create new admin user
                admin = User(
                    email=DEFAULT_ADMIN_EMAIL,
                    hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
                    full_name="Admin User",
                    is_active=True,
                    is_admin=True
                )
                session.add(admin)
                await session.commit()
                print(f"🎉 Default admin user created successfully!")
            
            print(f"\n📋 Default Admin Credentials:")
            print(f"   Email: {DEFAULT_ADMIN_EMAIL}")
            print(f"   Password: {DEFAULT_ADMIN_PASSWORD}")
            print(f"\n⚠️  Please change the default password after first login!")
            
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 Creating DocHarvester admin user...")
    asyncio.run(create_admin_user()) 