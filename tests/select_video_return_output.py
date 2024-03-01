from . import *
imports_for_testing()

import app
import clips
from datetime import datetime
from flask import Blueprint, render_template, request

ACTION = "/get_video"
#######################################
# TESTING VALUES - change these values
METHOD = "post"
NAVIGATE = True
CLIP_TREE = clips.detailed_clips_tree({
        clips.format_group_name("test_comp", datetime(2023, 2, 16)): ["match_1.mp4", "match_2.mp4", "match_3.mp4"],
        clips.format_group_name("test_comp", datetime(2023, 2, 17)): ["match_4.mp4", "match_5.mp4", "match_6.mp4"],
        clips.format_group_name("test_comp2", datetime(2023, 2, 18)): ["match_1.mp4", "match_2.mp4", "match_3.mp4"],
        clips.format_group_name("test_comp2", datetime(2023, 2, 19)): ["match_4.mp4", "match_5.mp4", "match_6.mp4"]
})
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

@bp.route(ACTION, methods=["GET", "POST"])
def get_video():
    if request.method == "POST":
        return repr(request.form.to_dict() | {name:file.filename for name,file in request.files.items()})
    else: #GET
        return repr(request.args.to_dict())

app.app.register_blueprint(clips.bp)
app.app.register_blueprint(bp)

if __name__ == "__main__":
    app.serve()