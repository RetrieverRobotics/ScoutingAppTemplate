from . import *
imports_for_testing()

import app
import clips
from datetime import datetime
from flask import Blueprint, render_template, url_for

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
SW_NAMESPACE = "client"
VIDEO_SELECTION_REDIRECT = "/test/after"
#######################################

#cite: https://stackoverflow.com/a/13318415
def has_no_empty_params(rule):
    defaults = rule.defaults if rule.defaults is not None else ()
    arguments = rule.arguments if rule.arguments is not None else ()
    return len(defaults) >= len(arguments)

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
def service_worker():
    assets = ["/", "/test", "/test/after"]
    return render_template(
        "sw/sw.js",
        SW_URL_NAMESPACE=SW_NAMESPACE,
        VIDEO_SELECTION_OUTPUT=ACTION,
        VIDEO_SELECTION_REDIRECT=VIDEO_SELECTION_REDIRECT,
        ASSETS=assets
    ), 200, {"Content-Type":"application/javascript"}

app.app.register_blueprint(clips.bp)
app.app.register_blueprint(bp)

if __name__ == "__main__":
    app.serve(threads=48)