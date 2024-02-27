from flask import Blueprint, redirect, render_template, request, session, url_for

PERFORM_AUTHENTICATION = True


SESSION_ID = "id"
SESSION_CREATED = "created"
SESSION_IS_AUTH = "is_auth"

def check_auth(id:int=None)->bool:
    if id is None:
        id = session.get(SESSION_ID)
    if id not in session_auth:
        return False
    data = session_auth[id]
    return bool(data.get(SESSION_IS_AUTH, False))

def auth_redirect(f):
    def inner(*args, **kwargs):
        if PERFORM_AUTHENTICATION and check_auth():
            return f(*args, **kwargs)
        else:
            #TODO
            ...
    inner.__name__ = f.__name__
    return inner

bp = Blueprint("viewdata", __name__, url_prefix="/data")
session_auth:dict[int, dict[str]] = {}

@bp.route("/auth", methods=["GET", "POST"])
def auth():
    if request.method == "POST":
        ...
    else:
        ...

@bp.get("/raw")
def raw_view():
    ...

@bp.get("/solo")
def solo_view():
    ...

@bp.get("/compare")
def compare_view():
    ...

@bp.get("/sort")
def sort_view():
    ...
