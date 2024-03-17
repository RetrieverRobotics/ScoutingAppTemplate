from flask import render_template, request, Response, session
import werkzeug.http

SESSION_ID = "id"

def get_session_id()->int|None:
    """Get the current session's ID"""
    return session.get(SESSION_ID)

def expects_params(title:str, where:str, keys:list[str], methods:list[str]=("POST",), code:int=400, headers:dict[str, str]|None=None):
    """
    When handling the decorated request with the specified methods, check that the source passed into `where` (form, args) has the listed parameters.

    If not, an error page will be returned with the given error code (default 400).
    """
    def decor(f):
        def wrapper(*args, **kwargs):
            if request.method in methods:
                search:dict[str, str] = getattr(request, where)
                missing = [key for key in keys if key not in search]
                if missing:
                    r = Response(render_template(
                        "bases/error.html",
                        ERROR_TITLE=title,
                        ERROR_CODE=code,
                        ERROR_NAME=werkzeug.http.HTTP_STATUS_CODES.get(code, "HTTP Error"),
                        ERROR_BODY=f"Your POST request was missing the following keys: {', '.join(missing)}."), 400
                    )
                    if headers:
                        r.headers.update(headers)
                    return r
            return f(*args, **kwargs)
        
        #make flask happy
        wrapper.__name__ = f.__name__
        wrapper.__doc__ = f.__doc__
        return wrapper
    return decor
