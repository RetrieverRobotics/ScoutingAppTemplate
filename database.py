from config import DB_COMP_URI, DB_SHARED_URI
from datetime import datetime, timezone
import hashlib
import sqlalchemy
import sqlalchemy.orm
from typing import Generator

NUM_GENERATOR_MAX = 1000 #must be a power of 10
HASH_ENCODING = "utf-8"
HASH_TIMES_MAX = 40

#cite: https://stackoverflow.com/a/12581268
#cite: https://stackoverflow.com/a/76446925
HASH_N = 2**14 #number of iterations
HASH_R = 8
HASH_P = 1
HASH_DK_LEN = 64

def __generate_num()->Generator[int, int, None]:
    """
    Generator for incrementing numbers in an infinite loop.
    """
    while True:
        i = 0
        while i < NUM_GENERATOR_MAX:
            i += yield i % NUM_GENERATOR_MAX #accounts for negative numbers

__num_generator = __generate_num()
__num_generator.send(None)

def get_increment()->int:
    """
    Get the current increment value.
    """
    return __num_generator.send(0)

def next_increment()->int:
    """
    Gets the current increment value, and increases it by 1.
    """
    return __num_generator.send(1)

def generate_id(dt:datetime=None)->int:
    """
    Takes a UTC datetime (or None to use the current time) as well as the current increment value,
    and generates a new ID. Increments the increment.
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    return int(dt.timestamp() * 1000) * NUM_GENERATOR_MAX + next_increment()

class DB:
    """
    Class for working with sqlalchemy databases.
    """

    def __init__(self, engine:sqlalchemy.Engine|str|sqlalchemy.engine.URL, metadata:sqlalchemy.MetaData|None=None, autoflush:bool=True, expire_on_commit:bool=True):
        self.engine = sqlalchemy.create_engine(url=engine) if isinstance(engine, (str, sqlalchemy.engine.URL)) else engine
        self.metadata = metadata if isinstance(metadata, sqlalchemy.MetaData) else sqlalchemy.MetaData()
        self.Base = sqlalchemy.orm.declarative_base(metadata=self.metadata)
        self.session_maker = sqlalchemy.orm.sessionmaker(bind=self.engine, autoflush=autoflush, expire_on_commit=expire_on_commit)
        self.session:sqlalchemy.orm.Session|None = None

    def create_session(self):
        """Create a session, if one has not already been created. Returns the session."""
        if self.session is None:
            self.session = self.session_maker()
        return self.session
    
    def close_session(self):
        """Close the current session, if one is open."""
        if self.session is not None:
            self.session.close()
            self.session = None
            
            
comp_db = DB(DB_COMP_URI)
shared_db = DB(DB_SHARED_URI)
web_sessions:set[int] = set() #IDs that have been generated for web sessions

def create_table(table:sqlalchemy.Table, engine:sqlalchemy.engine.Engine):
    """
    Adds the table's metadata to the database.
    """
    table.create(engine, checkfirst=True)

@classmethod
def drop_table(table:sqlalchemy.Table, engine:sqlalchemy.engine.Engine):
    """
    Drops the table's metadata from the database.
    """
    table.drop(engine, checkfirst=True)


def hash_password(raw:str, salt:bytes, n=HASH_N, r=HASH_R, p=HASH_P, length:int=HASH_DK_LEN)->bytes:
    """
    Hashes the given raw password with a salt (generated from something like os.urandom) and
    return the hashed password.

    The hash parameters `n`, `r`, and `p` are made available to change, though it is not recommened
    to do so for normal use (unless you know better).
    """
    #Make the password more unique before hashing

    rotated = [None]*len(raw)
    inc = (((len(raw) // 2) * (sum(ord(c) for c in raw)//5+1)) * (-1) ** len(raw))
    for i, c in enumerate(raw):
        rotated[(i+inc)%len(raw)] = c
    even = sum(1 for c in raw if not ord(c)%2) > sum(1 for c in raw if ord(c)%2)
    if even:
        top = [chr((ord(c)+1) % 0x10ffff) for c in rotated[:len(raw)//2]] # % 0x10ffff to keep char code within acceptable range of inputs for `chr`
        bottom = rotated[len(raw)//2:]
    else:
        top = rotated[:len(raw)//2]
        bottom = [chr((ord(c)+1) % 0x10ffff) for c in rotated[len(raw)//2:]]

    #Hash the final password several times
        
    final:str = "".join(top) + raw + "".join(bottom) + "".join(rotated)
    final_b = final.encode(HASH_ENCODING)
    raw_b = raw.encode("utf-8")

    hashed = hashlib.scrypt(final_b, salt=salt, n=n, r=r, p=p, dklen=length)

    times = max(len(raw), HASH_TIMES_MAX) + even
    for _ in range(times):
        hashed = hashlib.scrypt(hashed + final_b + raw_b, salt=salt, n=n, r=r, p=p, dklen=length)

    return hashed
