"""The project's own routes for the Python backend. There are none yet: add them to `router`.

Every route runs inside the sidecar, behind its token check. The renderer reaches these routes through the app:
`ab.sidecar.request({ method, path })`.
"""

from fastapi import APIRouter

router = APIRouter()
