from flask import Flask, redirect, render_template, session, url_for
import markupsafe
import os
import uuid
import viewdata
import waitress

APP_INDEX_REDIRECT = "INDEX_REDIRECT"

def get_secret_key():
    if os.path.isfile("secret_key"):
        with open("secret_key") as f:
            return f.read()
        
def _include_from(path:str, dir:str):
    if not os.path.isabs(path):
        path = os.path.join(os.path.abspath(dir), path)
    with open(path) as f:
        return f.read()
    
def include_template(path:str):
    return _include_from(path, app.template_folder)

def include_static(path:str):
    return _include_from(path, app.static_folder)

def as_style(src:str):
    return markupsafe.Markup(f"<style>{src}</style>")

def as_script(src:str):
    return markupsafe.Markup(f"<script>{src}</script>")

def from_style(path:str):
    return markupsafe.Markup(f"<style file=\"{url_for("static", filename=path)}\">{include_static(path)}</style>")

def from_script(path:str):
    return markupsafe.Markup(f"<script file=\"{url_for("static", filename=path)}\">{include_static(path)}</script>")

app = Flask(__name__)
app.url_map.strict_slashes = False
app.secret_key = get_secret_key()
app.jinja_env.globals["include_template"] = include_template
app.jinja_env.globals["include_static"] = include_static
app.jinja_env.globals["as_style"] = as_style
app.jinja_env.globals["as_script"] = as_script
app.jinja_env.globals["as_html"] = markupsafe.Markup
app.jinja_env.globals["from_style"] = from_style
app.jinja_env.globals["from_script"] = from_script

app.config[APP_INDEX_REDIRECT] = None

app.register_blueprint(viewdata.bp)

def set_index_redirect(f):
    module_name = f.__module__
    app.config[APP_INDEX_REDIRECT] = f.__name__ if module_name == "__main__" else f"{module_name}.{f.__name__}"
    return f

@app.before_request
def before():
    if "id" not in session:
        session["id"] = uuid.uuid4().hex

@app.get("/")
def index():
    return redirect(url_for(app.config[APP_INDEX_REDIRECT]))

def serve(host="0.0.0.0", port=80, **other):
    waitress.serve(app, host=host, port=port, **other)

#DEBUG

@set_index_redirect
@app.get("/test")
def test():
    return render_template("select_video.html")

if __name__ == "__main__":
    serve()