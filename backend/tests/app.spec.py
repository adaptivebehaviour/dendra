"""The sidecar app with the project's (initially empty) router: every route, including the built-in ones, needs the token."""

import pytest
from fastapi.testclient import TestClient

from ab_desktop.sidecar import create_app
from src.app import router

TOKEN = 't' * 40
AUTH = {'Authorization': f'Bearer {TOKEN}'}


@pytest.fixture
def client():
    return TestClient(create_app(token=TOKEN, routers=[router]))


def test_the_project_defines_no_routes_of_its_own():
    assert router.routes == []


def test_the_sidecar_answers_health_with_the_token(client):
    assert client.get('/health', headers=AUTH).json()['status'] == 'ok'


def test_the_routes_need_the_token(client):
    assert client.get('/health').status_code == 401
