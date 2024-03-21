from . import imports_for_testing
imports_for_testing()

import accounts
import config
import database
from datetime import datetime, timezone
import comp_tables
import os
from sqlalchemy import Boolean, Column, Integer
import string

CLEANUP = True


class CompData(comp_tables.Profile):

    __tablename__ = "profile"

    scores = Column(Integer, nullable=False)
    is_win = Column(Boolean, nullable=False)

    def __init__(self, id:int, match_id:int, account_id:int, robot:str, scores:int, is_win:bool):
        super().__init__(id, match_id, account_id, robot)
        self.scores = scores
        self.is_win = is_win


def main():

    #create tables

    accounts.Account.create_table()
    comp_tables.Match.create_table()
    CompData.create_table()

    #open sessions

    database.shared_db.create_session()
    database.comp_db.create_session()


    #do stuff ...

    host = object() #whatever goes here
    host.id = database.generate_id() #DEBUG init

    scouter = accounts.Account.create(name="Jake", email="name@mail.domain", raw_password="s0_Secur3!")
    database.shared_db.session.add(scouter)

    match1 = comp_tables.Match(id=database.generate_id(), host_id=host.id, date=datetime.now(timezone.utc), type=comp_tables.MatchType.QUAL, number=1)
    database.comp_db.session.add(match1)

    for i in range(4): #4 robots a match
        performance = CompData(id=database.generate_id(), match_id=match1.id, account_id=scouter.id, robot=string.ascii_uppercase[i%len(string.ascii_uppercase)], scores=10, is_win=True)
        database.comp_db.session.add(performance)


    #commit remaining changes

    database.shared_db.session.commit()
    database.comp_db.session.commit()

    #close sessions

    database.shared_db.close_session()
    database.comp_db.close_session()


if __name__ == "__main__":
    try:
        main()
    finally:
        #close dbs
        database.shared_db.engine.dispose()
        database.comp_db.engine.dispose()

        #cleanup
        if CLEANUP:
            os.remove(config.DB_SHARED_URI.split("///")[-1])
            os.remove(config.DB_COMP_URI.split("///")[-1])


    