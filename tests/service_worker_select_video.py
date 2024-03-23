from . import *
imports_for_testing()

import app
import clips
from datetime import datetime
from flask import Blueprint, render_template, Response, send_file

ACTION = "/get_video"
#######################################
# TESTING VALUES - change these values

#select_video template
METHOD = "post"
NAVIGATE = True
CLIP_TREE = clips.detailed_clips_tree({
        clips.format_group_name("test_comp", datetime(2023, 2, 16)): ["match_1.mp4", "match_2.mp4", "match_3.mp4"],
        clips.format_group_name("test_comp", datetime(2023, 2, 17)): ["match_4.mp4", "match_5.mp4", "match_6.mp4"],
        clips.format_group_name("test_comp2", datetime(2023, 2, 18)): ["match_1.mp4", "match_2.mp4", "match_3.mp4"],
        clips.format_group_name("test_comp2", datetime(2023, 2, 19)): ["match_4.mp4", "match_5.mp4", "match_6.mp4"]
})

#service worker
VIDEO_SELECTION_REDIRECT = "/test/after"
#######################################

bp = Blueprint("test", __name__)

@app.set_index_redirect
@bp.get("/test")
def test():
    return render_template(
        "select_video.html",
        SUBMISSION_DETAILS={"action":ACTION, "method":METHOD, "navigate":NAVIGATE},
        CLIP_TREE=CLIP_TREE 
    )

@bp.get("/test/after")
def test_after():
    return "<p>It worked!</p>"

@bp.get("/sw.js")
@app.set_service_worker
def service_worker():
    assets = {
        "/": {"behavior": "never"},
        "/test": {"behavior": "method", "methods":["get"]},
        "/test/after": {"behavior": "successful"}
    }
    response = Response(render_template(
        "sw/sw.js",
        VIDEO_SELECTION_OUTPUT=ACTION,
        VIDEO_SELECTION_REDIRECT=VIDEO_SELECTION_REDIRECT,
        ASSETS=assets,
        ASSETS_DEFAULT={"behavior":"never"}
    ), 200)
    response.headers["Content-Type"] = "application/javascript; charset=utf-8"
    return response

@bp.get("/manifest.json")
def get_manifest():
    return send_file("manifest.json", mimetype="application/json")

app.app.register_blueprint(clips.bp)
app.app.register_blueprint(bp)

if __name__ == "__main__":
    app.serve(threads=48)