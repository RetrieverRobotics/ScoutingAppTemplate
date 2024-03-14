from . import *
imports_for_testing()

import app
import clips
from datetime import datetime
from flask import Blueprint, render_template, render_template_string, send_file

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
    return render_template_string(
"""
{% extends "bases/match.html" %}
{% block extrastyles %}
<style>
    .input-system-page.input-system-page-current {
        display: flex;
        align-items: first baseline;
        flex-direction: column;
    }

    .input-system-page.input-system-page-current * {
        margin-top: 0.5em;
        margin-bottom: 0.5em;
    }
</style>
{% endblock %}
{% block extrascripts %}
<script>
    /** @type {string[]} */
    const threeClicks = [];

    window.addEventListener("load", () => {
        inputSystem.addInput(/*name*/"one",
        /*events*/{
            "input": inputSystem.bound.clearValidity, /* (ev, elm) => { elm.setCustomValidity(""); } */
            "change": inputSystem.bound.saveInput /* (ev, elm) => { inputSystem.saveValue(elm.name, elm.value); } */
        });

        inputSystem.addInput("two", {
            "input":inputSystem.bound.clearValidity,
            "change":inputSystem.bound.saveInput
        });

        inputSystem.addInput("three", {
            "click":(ev, elm) => {
                const now = new Date();
                threeClicks.push(now.toISOString());
            },
            "InputSystem::navigate":(ev, elm) => {
                //if you wanted to cancel the navigation event, then do ev.preventDefault();
                console.log(ev.page); //"pre-match" or "post-match", depending on the button that was pressed
                inputSystem.saveValue(elm.getAttribute("name"), threeClicks);
            }
        });

        //four would be the same as three, but with a different array

        inputSystem.addInput("five", {
            "input": inputSystem.bound.clearValidity,
            "change": inputSystem.bound.saveInput
        });

        inputSystem.addInput("six", {
            "change": inputSystem.bound.saveInput
        });

        inputSystem.applyNavigation();
        inputSystem.applySubmission(() => {
            console.log(inputSystem.data);
        });
    });
</script>
{% endblock %}

{% block inputs %}
<div></div>
<div class="input-pages">
    <div name="pre-match" class="input-system-page input-system-page-current">
        <input name="one" class="input-system-input"/>
        <input name="two" type="number" class="input-system-input"/>
        <button class="input-system-navigate" page="match">Next</button>
    </div>
    <div name="match" class="input-system-page">
        <button name="three" class="input-system-input">Three</button>
        <button name="four" class="input-system-input">Four</button>
        <button class="input-system-navigate" page="pre-match">Back</button>
        <button class="input-system-navigate" page="post-match">Next</button>
    </div>
    <div name="post-match" class="input-system-page">
        <textarea name="five" class="input-system-input"></textarea>
        <input name="six" type="range" class="input-system-input"/>
        <button class="input-system-navigate" page="match">Back</button>
        <button class="input-system-submit">Submit</button>
    </div>
</div>
{% endblock %}
""")

@bp.get("/sw.js")
def service_worker():
    assets = ["/", "/test", "/test/after", "/manifest.json"]
    return render_template(
        "sw/sw.js",
        SW_URL_NAMESPACE=SW_NAMESPACE,
        VIDEO_SELECTION_OUTPUT=ACTION,
        VIDEO_SELECTION_REDIRECT=VIDEO_SELECTION_REDIRECT,
        ASSETS=assets
    ), 200, {"Content-Type":"application/javascript"}

@bp.get("/manifest.json")
def get_manifest():
    return send_file("manifest.json", mimetype="application/json")

app.app.register_blueprint(clips.bp)
app.app.register_blueprint(bp)

if __name__ == "__main__":
    app.serve(threads=48)