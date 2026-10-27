"""Entry point of the Python backend. The Electron app starts it and stops it again; it is not
meant to be run by hand (it needs the AB_SIDECAR_TOKEN environment variable the app provides)."""

from ab_desktop.sidecar import serve

from src.app import router


def run() -> None:
    """Serve the project's routes on 127.0.0.1 behind the per-launch token."""
    serve([router], title='Sidecar')


if __name__ == '__main__':
    run()
