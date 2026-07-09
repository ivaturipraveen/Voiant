import asyncio
from app.runtime import AppRuntime
from app.services import dashboard_service

async def main():
    try:
        rt = AppRuntime()
        rt.bootstrap_synthetic()
        res = dashboard_service.recommendations_overview(rt, "admin")
        print("Success:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
