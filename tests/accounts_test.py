from . import *
imports_for_testing()

import accounts
import app
import clips
import database
from flask import Blueprint, render_template_string

bp = Blueprint("test", __name__)

@bp.get("/client/current")
def _current():
    return "\"/clips/load/test_comp.2023-02-16/match_1.mp4\"", 200, {"Content-Type":"application/json"} 

@bp.get("/sw.js")
@app.set_service_worker
def _sw():
    return "", 200, {"Content-Type": "application/javascript"}

@bp.get("/manifest.json")
def _manifest():
    return "{}", 200, {"Content-Type": "application/json"}

@app.set_index_redirect
@bp.get("/works")
def works():
    return "<p>It works</p>"

@bp.get("/match")
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

    localStorage.setItem(LOCAL_STORAGE_SW_URL_NAMESPACE, location.origin + "/client"); //i dont wanna set up the service worker :(

    window.addEventListener("load", () => {
        inputSystem.addInput(/*name*/"one",
        /*events*/{
            "InputSystem::start": fillAccountInfo("name"),
            "input": inputSystem.bound.clearValidity, /* (ev, elm) => { elm.setCustomValidity(""); } */
            "change": inputSystem.bound.saveInput /* (ev, elm) => { inputSystem.saveValue(elm.name, elm.value); } */
        });

        inputSystem.addInput("two", {
            "InputSystem::start": fillAccountInfo("email"),
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

        inputSystem.start();
    });
</script>
{% endblock %}

{% block inputs %}
<div></div>
<div class="input-pages">
    <div name="pre-match" class="input-system-page input-system-page-current">
        <input name="one" class="input-system-input"/>
        <input name="two" type="email" class="input-system-input"/>
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

app.app.register_blueprint(accounts.bp)
app.app.register_blueprint(clips.bp)
app.app.register_blueprint(bp)

if __name__ == "__main__":

    #start database sessions

    accounts.Account.create_table()
    database.shared_db.create_session()

    app.serve(threads=48)

    #close database sessions

    database.shared_db.session.commit()
    database.shared_db.close_session()