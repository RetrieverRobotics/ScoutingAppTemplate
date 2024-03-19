import database
from datetime import datetime
from enum import Enum
from flask import Blueprint, redirect, render_template, request, Response
import json
import os
import request_utils
import string
from sqlalchemy import BLOB, Column, Integer, String
import traceback

#NOTE: enable account through individual table create/drop; cite: https://stackoverflow.com/a/45287771

ACCOUNT_TABLENAME = "accounts"
ACCOUNT_DB_URI = "sqlite:///accounts.db"
ACCOUNT_SLOTS_PATH = "create_account.slots"

HEADER_CRED_VALIDITY = "Credential-Validity"

ACCOUNT_NAME_LENGTH = 100 #First + Last
EMAIL_LENGTH = 320 #maximum length; cite: https://emaillistvalidation.com/blog/demystifying-email-validation-understanding-the-maximum-length-of-email-addresses/
PASSWORD_LENGTH = 64 #number of bytes generated by hashing algorithm
PASSWORD_RAW_MIN = 8
PASSWORD_RAW_MAX = 1000
SALT_LENGTH = 128 #number of random bytes to generate for the salt

logged_in:dict[int, int] = {} #session ID -> Account ID

account_db = database.DB(ACCOUNT_DB_URI)
bp = Blueprint("accounts", __name__, url_prefix="/accounts")

def get_logged_in(session_id:int)->int|None:
    """
    Get the Account ID associated with the given session ID
    """
    return logged_in.get(session_id)

def log_in(session_id:int, account_id:int)->int|None:
    """
    Link an Account ID to a session ID. Will unlink the Account if it is already
    linked to another session. Returns the previous Account ID the session was linked
    to, or `None` if none.
    """
    prev = None
    for sess, acc in logged_in.items():
        if sess == session_id:
            prev = acc
        if acc == account_id:
            del logged_in[sess]

    logged_in[session_id] = account_id
    return prev
    
def check_slot(slot_id:int)->bool:
    """
    Checks if the given slot ID is valid.
    """
    if not os.path.isfile(ACCOUNT_SLOTS_PATH):
        return False
    with open(ACCOUNT_SLOTS_PATH) as f:
        slots = [int(id) for id in f.readlines() if id.strip()]

    return slot_id in slots

def use_slot(slot_id:int):
    """
    Marks the slot with the given ID as used, removing it from the list of open slots.
    """

    if not os.path.isfile(ACCOUNT_SLOTS_PATH):
        with open(ACCOUNT_SLOTS_PATH, "x") as f:
            f.close()

    with open(ACCOUNT_SLOTS_PATH) as f:
        lines = f.readlines()
    
    try:
        with open(ACCOUNT_SLOTS_PATH, "w") as f:
            f.writelines(id for id in lines if id.strip() and int(id) != slot_id)
    except Exception as e:
        traceback.print_exception(e)
        with open(ACCOUNT_SLOTS_PATH, "w") as f:
            f.writelines(lines)

class Account(account_db.Base):
    """
    SQLAlchemy declarative base (table) for storing scouter account data.
    """

    __tablename__ = ACCOUNT_TABLENAME

    id = Column(Integer, primary_key=True)
    name = Column(String(ACCOUNT_NAME_LENGTH), nullable=False)
    email = Column(String(EMAIL_LENGTH), unique=True, nullable=False)
    password = Column(BLOB(PASSWORD_LENGTH), nullable=False)
    salt = Column(BLOB(SALT_LENGTH), unique=True, nullable=False)

    @classmethod
    def create_table(cls, engine=account_db.engine):
        """
        Adds the table's metadata to the database.
        """
        if not database.sqlalchemy.inspect(engine).has_table(cls.__tablename__):
            cls.__table__.create(engine)

    @classmethod
    def drop_table(cls, engine=account_db.engine):
        """
        Drops the table's metadata from the database.
        """
        if database.sqlalchemy.inspect(engine).has_table(cls.__tablename__):
            cls.__table__.drop(engine)

    @classmethod
    def create(cls, name:str, email:str, raw_password:str, dt:datetime|None=None):
        """
        Creates a new Account from the given name, email, and raw password.

        A custom `datetime` can be specified for generating the Account's ID, but it is
        recommended that the current date and time is used when generating an ID.
        """
        salt = os.urandom(SALT_LENGTH)
        return cls(id=database.generate_id(dt), name=name, email=email, password=database.hash_password(raw_password, salt, length=PASSWORD_LENGTH), salt=salt)

    def __init__(self, id:int, name:str, email:str, password:bytes, salt:bytes):
        self.name = name
        self.email = email
        self.password = password
        self.salt = salt

    def check_password(self, password:str|bytes)->bool:
        """
        Checks if the given password matches the account's password.
        If the given password is a string, it will be hashed.
        """

        if isinstance(password, str):
            password = database.hash_password(password, self.salt, length=PASSWORD_LENGTH)
        
        return self.password == password



class AccountValidityCheck(Enum):
    """
    Possible outcomes when validating account credentials.
    """

    OK = 0                  #credentials are valid
    FAILED = 1              #failed for an unknown reason
    ID_EXISTS = 2           #tried to insert account with existing ID
    NAME_MISSING = 3        #name is missing
    NAME_SHORT = 4          #name is too short
    NAME_LONG = 5           #name is too long
    NAME_WRONG = 6          #name does not match the name stored with the account
    EMAIL_MISSING = 7       #email is missing
    EMAIL_SHORT = 8         #email is too short
    EMAIL_LONG = 9          #email is too long
    EMAIL_INVALID = 10      #email is invalid
    EMAIL_WRONG = 11        #email does not match with any accounts / matches with an existing account
    PASSWORD_MISSING = 12   #password is missing
    PASSWORD_SHORT = 13     #password is too short
    PASSWORD_LONG = 14      #password is too long
    PASSWORD_INVALID = 15   #password does not have required characters
    PASSWORD_WRONG = 16     #password does not match


def validate_credentials_existing(email:str, password:str|bytes, name:str|None=None):
    """
    Validates that the given account credentials are valid for an existing account.
    Expects for `accounts.account_db` to have an open session.

    If `password` is a string, it will be treated as a raw password and be hashed.
    If `name` is None, then it will be skipped.
    """

    try:
        if not email.strip():
            return AccountValidityCheck.EMAIL_MISSING
        elif name is not None and not name.strip():
            return AccountValidityCheck.NAME_MISSING
        elif isinstance(password, str):
            if not password.strip():
                return AccountValidityCheck.PASSWORD_MISSING

        account = account_db.session.query(Account).filter_by(email=email).first()

        if account is None:
            return AccountValidityCheck.EMAIL_WRONG
        elif name is not None and account.name != name:
            return AccountValidityCheck.NAME_WRONG
        elif not account.check_password(password):
            return AccountValidityCheck.PASSWORD_WRONG
        
        return AccountValidityCheck.OK

    except Exception as e:
        traceback.print_exception(e)
        return AccountValidityCheck.FAILED
    
def validate_credentials_new(email:str, name:str, password:str):
    """
    Validates that the given account credentials are valid to use when making a new account.
    Expects for `accounts.account_db` to have an open session.
    """

    try:
        whitespace = tuple(string.whitespace)
        if not email.strip():
            return AccountValidityCheck.EMAIL_MISSING
        elif len(email) > EMAIL_LENGTH:
            return AccountValidityCheck.EMAIL_LONG
        elif email.startswith(whitespace) or email.endswith(whitespace) or "@" not in email:
            return AccountValidityCheck.EMAIL_INVALID
        elif not name.strip():
            return AccountValidityCheck.NAME_MISSING
        elif len(name) > ACCOUNT_NAME_LENGTH:
            return AccountValidityCheck.NAME_LONG
        elif isinstance(password, str):
            if not password.strip():
                return AccountValidityCheck.PASSWORD_MISSING
            elif len(password) < PASSWORD_RAW_MIN:
                return AccountValidityCheck.PASSWORD_SHORT
            elif len(password) > PASSWORD_RAW_MAX:
                return AccountValidityCheck.PASSWORD_LONG
            elif not (any(symbol in password for symbol in string.punctuation) and any(lc in password for lc in string.ascii_lowercase)
                        and any(uc in password for uc in string.ascii_uppercase)):
                return AccountValidityCheck.PASSWORD_INVALID

        account = account_db.session.query(Account).filter_by(email=email).first()

        if account is not None:
            return AccountValidityCheck.EMAIL_WRONG
        
        return AccountValidityCheck.OK
    except Exception as e:
        traceback.print_exception(e)
        return AccountValidityCheck.FAILED

@bp.route("/create", methods=["GET", "POST"])
@request_utils.expects_params("Account | 400", "form", ("slot_id", "name", "email", "password"))
def route_create():
    """
    Handles account creation requests.

    GET - Responds with the account creation page if `slot_id` is present and valid, else respond with a "Hey you need a slot, you should contact someone here" page

    POST - Takes account credentials and attempts to create an account

    Credentials:
    - slot_id
    - name
    - email
    - password
    """

    if request.method == "POST":
        slot_id = request.form["slot_id"]
        name = request.form["name"]
        email = request.form["email"]
        password = request.form["password"]

        if not (slot_id.isdecimal() and check_slot(int(slot_id))):
            return render_template("no_slot.html"), 401

        validity = validate_credentials_new(email, name, password)

        if validity == AccountValidityCheck.OK:
            account = Account.create(name, email, password)
            account_db.session.add(account)
            account_db.session.commit()
            use_slot(int(slot_id))
            log_in(request_utils.get_session_id(), account.id)
            return redirect("/", code=303) #redirect to index
        elif validity == AccountValidityCheck.NAME_MISSING:
            validity_message = "Name is required."
        elif validity in (AccountValidityCheck.NAME_SHORT, AccountValidityCheck.NAME_LONG):
            validity_message = f"Name must be at most {ACCOUNT_NAME_LENGTH} characters long."
        elif validity == AccountValidityCheck.EMAIL_MISSING:
            validity_message = "Email is required."
        elif validity in (AccountValidityCheck.EMAIL_SHORT, AccountValidityCheck.EMAIL_LONG):
            validity_message = f"Email must be at most {EMAIL_LENGTH} characters long."
        elif validity == AccountValidityCheck.EMAIL_INVALID:
            validity_message = "Email is of an invalid format."
        elif validity == AccountValidityCheck.EMAIL_WRONG:
            validity_message = "An account with this email already exists."
        elif validity == AccountValidityCheck.PASSWORD_MISSING:
            validity_message = "Password is required."
        elif validity in (AccountValidityCheck.PASSWORD_SHORT, AccountValidityCheck.PASSWORD_LONG):
            validity_message = f"Password must be between {PASSWORD_RAW_MIN} and {PASSWORD_RAW_MAX} characters long."
        elif validity == AccountValidityCheck.PASSWORD_INVALID:
            validity_message = "Password must contain one symbol, one upper case letter, and one lower case letter."
        else:
            validity_message = "An unexpected error happened while validating your credentials."

        response = Response(render_template("accounts/create.html", VALIDITY_MESSAGE=validity_message, VALIDITY_CODE=validity.value), 400)
        if validity is not None:
            response.headers[HEADER_CRED_VALIDITY] = str(validity.value)
        
        return response

    else:
        slot_id = request.args.get("slot_id")
        if slot_id is None or not (slot_id.isdigit() and check_slot(int(slot_id))):
            return render_template("accounts/no_slot.html"), 401
        
        return render_template("accounts/create.html")

@bp.route("/login", methods=["GET", "POST"])
@request_utils.expects_params("Account | 400", "form", ("email", "password"))
def route_login():
    """
    Handles login requests.

    GET - Responds with the login page

    POST - Takes account credentials and attempts to log in

    Credentials:
    - email
    - password
    """

    if request.method == "POST":
        email = request.form["email"]
        password = request.form["password"]

        validity = validate_credentials_existing(email, password)
        account = account_db.session.query(Account).filter_by(email=email).first()

        if account is not None and validity == AccountValidityCheck.OK:
            log_in(request_utils.get_session_id(), account.id)
            return redirect("/", code=303) #redirect to index
        elif validity == AccountValidityCheck.EMAIL_MISSING:
            validity_message = "Email is required."
        elif validity == AccountValidityCheck.EMAIL_WRONG:
            validity_message = "This email is not associated with an account."
        elif validity == AccountValidityCheck.PASSWORD_MISSING:
            validity_message = "Password is required."
        elif validity == AccountValidityCheck.PASSWORD_WRONG:
            validity_message = "Password is wrong."
        else:
            validity_message = "An unexpected error happened while validating your credentials."

        response = Response(render_template("accounts/login.html", VALIDITY_MESSAGE=validity_message, VALIDITY_CODE=validity.value), 400)
        if validity is not None:
            response.headers[HEADER_CRED_VALIDITY] = str(validity.value) #for programatic use

        return response
    else:
        return render_template("accounts/login.html")

@bp.get("/info")
def get_info():
    account_id = get_logged_in(request_utils.get_session_id())
    account = account_db.session.query(Account).filter_by(id=account_id).first()

    response = Response("null" if account is None else json.dumps({"name":account.name, "email":account.email}))
    response.headers["Content-Type"] = "application/json; charset=utf-8"

    return response