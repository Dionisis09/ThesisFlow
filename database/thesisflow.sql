-- ThesisFlow SQLite export
-- Generated from data/dev.db with: npm run db:export
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE "CommitteeInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thesisId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "respondedAt" INTEGER,
    CONSTRAINT "CommitteeInvitation_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommitteeInvitation_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CommitteeMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thesisId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommitteeMember_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommitteeMember_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Grade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thesisId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "criteriaJson" TEXT,
    CONSTRAINT "Grade_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Grade_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PresentationDetails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thesisId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "room" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "mode" TEXT NOT NULL DEFAULT 'IN_PERSON', "meetingUrl" TEXT,
    CONSTRAINT "PresentationDetails_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Professor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Professor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "am" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "address" TEXT,
    "academicStatus" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "mobile" TEXT, "landline" TEXT,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Thesis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNDER_ASSIGNMENT',
    "draftUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "officialAssignedAt" INTEGER, "assignmentGsNumber" TEXT, "assignmentGsYear" INTEGER, "finalRepositoryUrl" TEXT, "gradingOpen" INTEGER NOT NULL DEFAULT 0, "cancellationGsNumber" TEXT, "cancellationGsYear" INTEGER, "cancellationReason" TEXT,
    CONSTRAINT "Thesis_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Thesis_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Professor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Thesis_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ThesisHistory" (
	id VARCHAR NOT NULL, 
	"thesisId" VARCHAR NOT NULL, 
	"fromStatus" VARCHAR, 
	"toStatus" VARCHAR NOT NULL, 
	"actorUserId" VARCHAR, 
	note TEXT, 
	"createdAt" BIGINT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY("thesisId") REFERENCES "Thesis" (id) ON DELETE CASCADE, 
	FOREIGN KEY("actorUserId") REFERENCES "User" (id) ON DELETE SET NULL
);

CREATE TABLE "ThesisMaterial" (
	id VARCHAR NOT NULL, 
	"thesisId" VARCHAR NOT NULL, 
	label VARCHAR NOT NULL, 
	url VARCHAR NOT NULL, 
	"createdAt" BIGINT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY("thesisId") REFERENCES "Thesis" (id) ON DELETE CASCADE
);

CREATE TABLE "ThesisNote" (
	id VARCHAR NOT NULL, 
	"thesisId" VARCHAR NOT NULL, 
	"professorId" VARCHAR NOT NULL, 
	text VARCHAR(300) NOT NULL, 
	"createdAt" BIGINT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY("thesisId") REFERENCES "Thesis" (id) ON DELETE CASCADE, 
	FOREIGN KEY("professorId") REFERENCES "Professor" (id) ON DELETE CASCADE
);

CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "descriptionUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "supervisorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Topic_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Professor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('cmls7ay3h000ti0ag8hkmuvht', 'cmls6n08o001qi0yg1slqz5nl', 'cmls6mp130006i0ncsxo9nec9', 'ACCEPTED', 1771429360157, NULL);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('cmls7ay3n000vi0agg8k49k3l', 'cmls6n08o001qi0yg1slqz5nl', 'cmls6mp190009i0nco30b6sef', 'PENDING', 1771429360164, NULL);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('cmluzsn1f0007i0ho5j4jmdnr', 'cmluzsb5g0005i0hoosrdc5ul', 'cmls6mp1g000ci0ncwj51ozsb', 'ACCEPTED', 1771598147235, NULL);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('cmluzsn1m0009i0hoitmj69rm', 'cmluzsb5g0005i0hoosrdc5ul', 'cmls6mp1n000fi0ncb9pdwn26', 'ACCEPTED', 1771598147243, NULL);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('cmlv09cte000pi0ho1k96qz5m', 'cmls6n08o001qi0yg1slqz5nl', 'cmls6mp1n000fi0ncb9pdwn26', 'ACCEPTED', 1771598927138, NULL);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('8ab643862c4c4ddca619aa802842346f', 'b2880566793740678315653e45a63c9d', 'cmls6mp130006i0ncsxo9nec9', 'ACCEPTED', 1786207530464, 1786207530464);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('0a98650a3b5a4e58b851b625f91c433f', 'b2880566793740678315653e45a63c9d', 'cmls6mp190009i0nco30b6sef', 'ACCEPTED', 1786207530465, 1786207530465);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('5c37662e8c56411c86402f2dd78721ac', 'c9e5a3d586604e2aa905fc6733374db4', 'cmls6mp130006i0ncsxo9nec9', 'ACCEPTED', 1786207530468, 1786207530468);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('c4594326319444a5854c6db628fa57e2', 'c9e5a3d586604e2aa905fc6733374db4', 'cmls6mp190009i0nco30b6sef', 'ACCEPTED', 1786207530469, 1786207530469);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('9d3a7d8b40fb48d79b011119763147e7', 'badf4d8d5afc4aaf91bada030c524215', 'cmls6mp130006i0ncsxo9nec9', 'ACCEPTED', 1786207530473, 1786207530473);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('919528dbf16443be92fc707ed4f0f551', 'badf4d8d5afc4aaf91bada030c524215', 'cmls6mp190009i0nco30b6sef', 'ACCEPTED', 1786207530474, 1786207530474);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('146746844e66486a81c872bb0bdd153d', '9ad8fbeeda764d1a97f27d63a0d391ce', 'cmls6mp130006i0ncsxo9nec9', 'ACCEPTED', 1786207530479, 1786207530478);
INSERT INTO "CommitteeInvitation" ("id", "thesisId", "professorId", "status", "createdAt", "respondedAt") VALUES ('f726a10e71ba43619af5de3f5a6992ee', '9ad8fbeeda764d1a97f27d63a0d391ce', 'cmls6mp190009i0nco30b6sef', 'ACCEPTED', 1786207530479, 1786207530479);

INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('cmls7bjy4000xi0agze2hv97h', 'cmls6n08o001qi0yg1slqz5nl', 'cmls6mp130006i0ncsxo9nec9', 'MEMBER1', 1771429388476);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('cmluzsvsb000bi0hoziuidil0', 'cmluzsb5g0005i0hoosrdc5ul', 'cmls6mp1n000fi0ncb9pdwn26', 'MEMBER1', 1771598158571);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('cmluzt75z000di0hopfrn1gbj', 'cmluzsb5g0005i0hoosrdc5ul', 'cmls6mp1g000ci0ncwj51ozsb', 'MEMBER2', 1771598173319);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('cmlv09d2r000ri0ho03oi9kv8', 'cmls6n08o001qi0yg1slqz5nl', 'cmls6mp1n000fi0ncb9pdwn26', 'MEMBER2', 1771598927476);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('6508814d36ae415fb3357e67e9246566', 'b2880566793740678315653e45a63c9d', 'cmls6mp130006i0ncsxo9nec9', 'MEMBER1', 1786207530465);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('e39fbc72de12415e98bf32ec8f84c564', 'b2880566793740678315653e45a63c9d', 'cmls6mp190009i0nco30b6sef', 'MEMBER2', 1786207530466);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('b9d5ed8ec05e4841b10485e03fa99579', 'c9e5a3d586604e2aa905fc6733374db4', 'cmls6mp130006i0ncsxo9nec9', 'MEMBER1', 1786207530469);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('553a78b7c49f44588c8663a295b4635e', 'c9e5a3d586604e2aa905fc6733374db4', 'cmls6mp190009i0nco30b6sef', 'MEMBER2', 1786207530469);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('eb769f9f47134b58b69cbf9287dc02df', 'badf4d8d5afc4aaf91bada030c524215', 'cmls6mp130006i0ncsxo9nec9', 'MEMBER1', 1786207530473);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('97dcc5bda9414a52bd6e09fb157cacbf', 'badf4d8d5afc4aaf91bada030c524215', 'cmls6mp190009i0nco30b6sef', 'MEMBER2', 1786207530474);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('cc1f0ba8178c4a0f9719edb8e94a8143', '9ad8fbeeda764d1a97f27d63a0d391ce', 'cmls6mp130006i0ncsxo9nec9', 'MEMBER1', 1786207530479);
INSERT INTO "CommitteeMember" ("id", "thesisId", "professorId", "role", "createdAt") VALUES ('7c9f2ff6a7b14c2bafd0612855e04c2a', '9ad8fbeeda764d1a97f27d63a0d391ce', 'cmls6mp190009i0nco30b6sef', 'MEMBER2', 1786207530480);

INSERT INTO "Grade" ("id", "thesisId", "professorId", "value", "comments", "createdAt", "updatedAt", "criteriaJson") VALUES ('cmluzbhng0009i0rgn7yn2uwi', 'cmluzb3ie0007i0rg0f2luyr7', 'cmls619wl0004i0uomiu228zk', 6.5, 'via UI', 1771597347100, 1771597442769, NULL);
INSERT INTO "Grade" ("id", "thesisId", "professorId", "value", "comments", "createdAt", "updatedAt", "criteriaJson") VALUES ('cmluzve11000hi0hoh6ffr9gj', 'cmluzsb5g0005i0hoosrdc5ul', 'cmls6mp1n000fi0ncb9pdwn26', 6, 'via UI', 1771598275526, 1771598392580, NULL);
INSERT INTO "Grade" ("id", "thesisId", "professorId", "value", "comments", "createdAt", "updatedAt", "criteriaJson") VALUES ('cmluzvozs000ji0ho0s0ehrcy', 'cmluzsb5g0005i0hoosrdc5ul', 'cmls6mp1g000ci0ncwj51ozsb', 10.1, 'via UI', 1771598289736, 1771598289736, NULL);
INSERT INTO "Grade" ("id", "thesisId", "professorId", "value", "comments", "createdAt", "updatedAt", "criteriaJson") VALUES ('cmlv09d5t000ti0ho4a0184yf', 'cmls6n08o001qi0yg1slqz5nl', 'cmls6mp1n000fi0ncb9pdwn26', 8, 'smoke-valid', 1771598927585, 1771598951146, NULL);
INSERT INTO "Grade" ("id", "thesisId", "professorId", "value", "comments", "createdAt", "updatedAt", "criteriaJson") VALUES ('558f7a0df44b4068baa1f69f6adffcc1', 'badf4d8d5afc4aaf91bada030c524215', 'cmls619wl0004i0uomiu228zk', 8.5, 'Demo αναλυτική βαθμολογία', 1786207530475, 1786207530475, '{"written": 8.0, "presentation": 8.5, "overall": 9}');
INSERT INTO "Grade" ("id", "thesisId", "professorId", "value", "comments", "createdAt", "updatedAt", "criteriaJson") VALUES ('0f73081c9454487ba2303d4d192fe834', 'badf4d8d5afc4aaf91bada030c524215', 'cmls6mp130006i0ncsxo9nec9', 8.67, 'Demo αναλυτική βαθμολογία', 1786207530476, 1786207530476, '{"written": 8.5, "presentation": 8.5, "overall": 9}');
INSERT INTO "Grade" ("id", "thesisId", "professorId", "value", "comments", "createdAt", "updatedAt", "criteriaJson") VALUES ('970db9da7bdb4d15aa05ad9f105c2ac5', 'badf4d8d5afc4aaf91bada030c524215', 'cmls6mp190009i0nco30b6sef', 8.83, 'Demo αναλυτική βαθμολογία', 1786207530476, 1786207530476, '{"written": 9.0, "presentation": 8.5, "overall": 9}');

INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmls619x00009i0uogr7htaai', 'seed', '{"users":["sec@uni.local","prof1@uni.local","s1@uni.local"],"thesisId":"cmls619ww0008i0uo6tgau6r6"}', 1771427229300);
INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmls6n08r001ri0ygk12c8okz', 'seed', '{"users":{"secretariat":"sec@uni.local","professors":[{"code":"P001","email":"prof001@uni.local"},{"code":"P002","email":"prof002@uni.local"},{"code":"P003","email":"prof003@uni.local"},{"code":"P004","email":"prof004@uni.local"},{"code":"P005","email":"prof005@uni.local"},{"code":"P006","email":"prof006@uni.local"},{"code":"P007","email":"prof007@uni.local"},{"code":"P008","email":"prof008@uni.local"},{"code":"P009","email":"prof009@uni.local"},{"code":"P010","email":"prof010@uni.local"}],"students":[{"am":"S001","email":"student001@uni.local"},{"am":"S002","email":"student002@uni.local"},{"am":"S003","email":"student003@uni.local"},{"am":"S004","email":"student004@uni.local"},{"am":"S005","email":"student005@uni.local"},{"am":"S006","email":"student006@uni.local"},{"am":"S007","email":"student007@uni.local"},{"am":"S008","email":"student008@uni.local"},{"am":"S009","email":"student009@uni.local"},{"am":"S010","email":"student010@uni.local"}]},"thesisId":"cmls6n08o001qi0yg1slqz5nl"}', 1771428243196);
INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmls6vpzt001ri01g6a9c5m22', 'seed', '{"users":{"secretariat":"sec@uni.local","professors":[{"code":"P001","email":"prof001@uni.local"},{"code":"P002","email":"prof002@uni.local"},{"code":"P003","email":"prof003@uni.local"},{"code":"P004","email":"prof004@uni.local"},{"code":"P005","email":"prof005@uni.local"},{"code":"P006","email":"prof006@uni.local"},{"code":"P007","email":"prof007@uni.local"},{"code":"P008","email":"prof008@uni.local"},{"code":"P009","email":"prof009@uni.local"},{"code":"P010","email":"prof010@uni.local"}],"students":[{"am":"S001","email":"student001@uni.local"},{"am":"S002","email":"student002@uni.local"},{"am":"S003","email":"student003@uni.local"},{"am":"S004","email":"student004@uni.local"},{"am":"S005","email":"student005@uni.local"},{"am":"S006","email":"student006@uni.local"},{"am":"S007","email":"student007@uni.local"},{"am":"S008","email":"student008@uni.local"},{"am":"S009","email":"student009@uni.local"},{"am":"S010","email":"student010@uni.local"}]},"thesisId":"cmls6n08o001qi0yg1slqz5nl"}', 1771428649818);
INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmls72hsq000ii0aggekwqa3f', 'people', '{"students":[{"am":"111111","firstName":"Maria","lastName":"Papadopoulou","email":"maria.111111@uni.gr"},{"am":"222222","firstName":"Nikos","lastName":"Georgiou","email":"nikos.222222@uni.gr"},{"am":"333333","firstName":"Eleni","lastName":"Ioannou","email":"eleni.333333@uni.gr"}],"professors":[{"code":"P001","firstName":"Dimitrios","lastName":"Kostas","email":"d.kostas@uni.gr"},{"code":"P002","firstName":"Sofia","lastName":"Mani","email":"s.mani@uni.gr"},{"code":"P003","firstName":"Giorgos","lastName":"Lazarou","email":"g.lazarou@uni.gr"}]}', 1771428965787);
INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmls72hve000ji0agmf23jxci', 'academic-status', '{"academic_status":[{"am":"111111","ects":210,"remaining_courses":2},{"am":"222222","ects":240,"remaining_courses":0},{"am":"333333","ects":198,"remaining_courses":4}]}', 1771428965883);
INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmls78mcb001ri0qse1izzex8', 'seed', '{"users":{"secretariat":"sec@uni.local","professors":[{"code":"P001","email":"prof001@uni.local"},{"code":"P002","email":"prof002@uni.local"},{"code":"P003","email":"prof003@uni.local"},{"code":"P004","email":"prof004@uni.local"},{"code":"P005","email":"prof005@uni.local"},{"code":"P006","email":"prof006@uni.local"},{"code":"P007","email":"prof007@uni.local"},{"code":"P008","email":"prof008@uni.local"},{"code":"P009","email":"prof009@uni.local"},{"code":"P010","email":"prof010@uni.local"}],"students":[{"am":"S001","email":"student001@uni.local"},{"am":"S002","email":"student002@uni.local"},{"am":"S003","email":"student003@uni.local"},{"am":"S004","email":"student004@uni.local"},{"am":"S005","email":"student005@uni.local"},{"am":"S006","email":"student006@uni.local"},{"am":"S007","email":"student007@uni.local"},{"am":"S008","email":"student008@uni.local"},{"am":"S009","email":"student009@uni.local"},{"am":"S010","email":"student010@uni.local"}]},"thesisId":"cmls6n08o001qi0yg1slqz5nl"}', 1771429251612);
INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmluzcuht000ci0rgs706orye', 'GS_MINUTES', '{"thesisId":"cmluzb3ie0007i0rg0f2luyr7","minutes":"ghjgyj","at":"2026-02-20T14:23:30.400Z"}', 1771597410401);
INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmluzcvvw000di0rgs205ti5r', 'GS_MINUTES', '{"thesisId":"cmluzb3ie0007i0rg0f2luyr7","minutes":"ghjgyj","at":"2026-02-20T14:23:32.203Z"}', 1771597412204);
INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmlv0j9hu001gi0hop7anvp1z', 'people', '{"students":[{"am":"S001","firstName":"Student001-Updated","lastName":"Demo","email":"student001@uni.local"},{"am":"S002","firstName":"Student002-Updated","lastName":"Demo","email":"student002@uni.local"},{"am":"S003","firstName":"Student003-Updated","lastName":"Demo","email":"student003@uni.local"}],"professors":[{"code":"P001","firstName":"Professor001-Updated","lastName":"Demo","email":"prof001@uni.local"},{"code":"P005","firstName":"Professor005-Updated","lastName":"Demo","email":"prof005@uni.local"},{"code":"P008","firstName":"Professor008-Updated","lastName":"Demo","email":"prof008@uni.local"}]}', 1771599389394);
INSERT INTO "ImportLog" ("id", "type", "payload", "createdAt") VALUES ('cmlv0j9j3001hi0hotlusv6qt', 'academic-status', '{"academic_status":[{"am":"S001","ects":210,"remaining_courses":2},{"am":"S002","ects":198,"remaining_courses":3},{"am":"S003","ects":225,"remaining_courses":1},{"am":"S010","ects":240,"remaining_courses":0}]}', 1771599389440);

INSERT INTO "PresentationDetails" ("id", "thesisId", "date", "room", "title", "createdAt", "updatedAt", "mode", "meetingUrl") VALUES ('cmls7td620015i0agm6mlobq8', 'cmls6n08o001qi0yg1slqz5nl', 1770292560000, 'A2', 'Παρουσίαση Διπλωματικής 11', 1771430219499, 1771430953057, 'IN_PERSON', NULL);
INSERT INTO "PresentationDetails" ("id", "thesisId", "date", "room", "title", "createdAt", "updatedAt", "mode", "meetingUrl") VALUES ('cmluzuj7p000fi0hohzknju0r', 'cmluzsb5g0005i0hoosrdc5ul', 1771936620000, 'A2', 'Παρουσίαση Διπλωματικής 9', 1771598235589, 1771598337102, 'IN_PERSON', NULL);
INSERT INTO "PresentationDetails" ("id", "thesisId", "date", "room", "title", "createdAt", "updatedAt", "mode", "meetingUrl") VALUES ('29537ee84ebf42dda068596106aed931', 'c9e5a3d586604e2aa905fc6733374db4', 1787417130471, 'Αίθουσα Β4', 'Παρουσίαση: Demo διπλωματική - UNDER_EXAM', 1786207530471, 1786207530471, 'IN_PERSON', NULL);
INSERT INTO "PresentationDetails" ("id", "thesisId", "date", "room", "title", "createdAt", "updatedAt", "mode", "meetingUrl") VALUES ('e94fd6f4c1d745458cb30f0a61e35905', 'badf4d8d5afc4aaf91bada030c524215', 1783615530474, 'Αίθουσα Β4', 'Παρουσίαση: Demo διπλωματική - COMPLETED', 1786207530474, 1786207530474, 'IN_PERSON', NULL);

INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls619wl0004i0uomiu228zk', 'P001', 'Professor001-Updated', 'Demo', 'cmls6mp0s0001i0nc5r8zscb6', 1771427229286);
INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls6mp130006i0ncsxo9nec9', 'P002', 'Professor002', 'Demo', 'cmls6mp0z0004i0ncsfbnfxz6', 1771428228663);
INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls6mp190009i0nco30b6sef', 'P003', 'Professor003', 'Demo', 'cmls6mp160007i0nc0jttdiyy', 1771428228670);
INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls6mp1g000ci0ncwj51ozsb', 'P004', 'Professor004', 'Demo', 'cmls6mp1c000ai0ncjxii4pge', 1771428228676);
INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls6mp1n000fi0ncb9pdwn26', 'P005', 'Professor005-Updated', 'Demo', 'cmls6mp1j000di0nc1vjgpu5i', 1771428228683);
INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls6mp1t000ii0nckyrpns72', 'P006', 'Professor006', 'Demo', 'cmls6mp1q000gi0nccarwu6ns', 1771428228690);
INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls6mp20000li0ncim11e368', 'P007', 'Professor007', 'Demo', 'cmls6mp1x000ji0nc1yktyi51', 1771428228696);
INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls6mp26000oi0ncrxl5cs7w', 'P008', 'Professor008-Updated', 'Demo', 'cmls6mp23000mi0ncsu15ddk8', 1771428228702);
INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls6mp2c000ri0nc6jlbrtrp', 'P009', 'Professor009', 'Demo', 'cmls6mp29000pi0nc0lo3ut0a', 1771428228709);
INSERT INTO "Professor" ("id", "code", "firstName", "lastName", "userId", "createdAt") VALUES ('cmls6mp2i000ui0nc07elu44k', 'P010', 'Professor010', 'Demo', 'cmls6mp2f000si0ncquypha7u', 1771428228715);

INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls619wq0006i0uoajooupyu', 'S0001', 'Student', 'One', 'Athens', 'active', 'cmls619wh0002i0uoshf86ylm', 1771427229290, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp2p000xi0nc8xs4elir', 'S001', 'Student001-Updated', 'Demo', 'Athens 5', 'active', 'cmls6mp2m000vi0nc0h8essfb', 1771428228721, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp2v0010i0nco32jvvcu', 'S002', 'Student002-Updated', 'Demo', 'Athens', 'active', 'cmls6mp2s000yi0nc8oluzccz', 1771428228728, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp310013i0ncom3o8dxc', 'S003', 'Student003-Updated', 'Demo', 'Athens', 'active', 'cmls6mp2y0011i0ncoekw5gyn', 1771428228733, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp370016i0nct7zsqldq', 'S004', 'Student004', 'Demo', 'Athens', 'active', 'cmls6mp340014i0ncfqxljtyb', 1771428228740, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp3d0019i0ncpu1tr15w', 'S005', 'Student005', 'Demo', 'Athens', 'active', 'cmls6mp3a0017i0ncin6uj9zw', 1771428228746, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp3j001ci0nc6sv9hm6t', 'S006', 'Student006', 'Demo', 'Athens', 'active', 'cmls6mp3g001ai0ncggjqxk47', 1771428228752, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp3q001fi0nc0njb4qyf', 'S007', 'Student007', 'Demo', 'Athens', 'active', 'cmls6mp3n001di0ncdrzslxy1', 1771428228758, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp3w001ii0ncoi59borg', 'S008', 'Student008', 'Demo', 'Athens', 'active', 'cmls6mp3t001gi0nch19kyce0', 1771428228764, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp42001li0nc7uzk3ng5', 'S009', 'Student009', 'Demo', 'Athens', 'active', 'cmls6mp3z001ji0ncf22pfk3y', 1771428228771, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls6mp48001oi0ncnmbyweiu', 'S010', 'Student010', 'Demo', 'Athens', 'active', 'cmls6mp45001mi0ncywdanyd4', 1771428228777, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls72hr40002i0agjezj4jpl', '111111', 'Maria', 'Papadopoulou', NULL, NULL, 'cmls72hql0000i0ag1qm6osq7', 1771428965728, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls72hrf0005i0ag885dvaia', '222222', 'Nikos', 'Georgiou', NULL, NULL, 'cmls72hra0003i0ago7cq1gq3', 1771428965740, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('cmls72hrs0008i0ag0k1oelbo', '333333', 'Eleni', 'Ioannou', NULL, NULL, 'cmls72hrm0006i0agc78y4kvf', 1771428965753, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('73d9f447e91e430dbc19e31270786774', 'D001', 'Φοιτητής 1', 'Demo', 'Πάτρα', '{"ects":210,"remaining_courses":2}', '6bc7166e3fdc46749d7600f09c5caba2', 1786207530454, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('b5074e39308f42399b2627b5bddf175e', 'D002', 'Φοιτητής 2', 'Demo', 'Πάτρα', '{"ects":210,"remaining_courses":2}', '54785ed1a9ee4cd68f90e27c3b843153', 1786207530462, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('64d2697371524517ba8ea54ff22c0b58', 'D003', 'Φοιτητής 3', 'Demo', 'Πάτρα', '{"ects":210,"remaining_courses":2}', '17069147f9764d59bf84a6956f6497b4', 1786207530467, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('53a6393043cb4d46b4a6ee04ddd19eaf', 'D004', 'Φοιτητής 4', 'Demo', 'Πάτρα', '{"ects":210,"remaining_courses":2}', 'a76475011b164d58aa0945a52ddda3b9', 1786207530472, NULL, NULL);
INSERT INTO "Student" ("id", "am", "firstName", "lastName", "address", "academicStatus", "userId", "createdAt", "mobile", "landline") VALUES ('5a859287f5ed49a2838c2006aa147d93', 'D005', 'Φοιτητής 5', 'Demo', 'Πάτρα', '{"ects":210,"remaining_courses":2}', '1988f372ba814c01a60394270afca51e', 1786207530477, NULL, NULL);

INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('cmls6n08o001qi0yg1slqz5nl', 'cmls6mp2p000xi0nc8xs4elir', 'cmls619wl0004i0uomiu228zk', 'seed-topic-1', 'ACTIVE', '/uploads/8e411b93-b950-4897-a884-e83483c31cc4.pdf', 1771428243192, 1771598951115, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('cmls7dnaw0011i0agdl74e1tk', 'cmls6mp310013i0ncom3o8dxc', 'cmls6mp130006i0ncsxo9nec9', 'cmls7cwwq000zi0ag0l29g2bu', 'ACTIVE', NULL, 1771429486137, 1771429694908, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('cmlurll1j0003i0rgs54e9536', 'cmls6mp2v0010i0nco32jvvcu', 'cmls619wl0004i0uomiu228zk', 'cmlurgl3y0001i0rgaplrndqp', 'UNDER_ASSIGNMENT', NULL, 1771584381127, 1771584381127, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('cmluzb3ie0007i0rg0f2luyr7', 'cmls6mp370016i0nct7zsqldq', 'cmls619wl0004i0uomiu228zk', 'cmluzabhx0005i0rgj7xiisc6', 'ACTIVE', NULL, 1771597328775, 1771597412196, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('cmluzsb5g0005i0hoosrdc5ul', 'cmls6mp3d0019i0ncpu1tr15w', 'cmls6mp26000oi0ncrxl5cs7w', 'cmluzs4260003i0hou4cmu6b7', 'UNDER_EXAM', '/uploads/28fa2f03-89da-41b3-a38d-437e93863f03.pdf', 1771598131828, 1771599598235, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('cmlv2z2t1001pi0hou571vdyo', 'cmls6mp48001oi0ncnmbyweiu', 'cmls619wl0004i0uomiu228zk', 'cmlv2xcxw001ni0ho6s3zbbiq', 'UNDER_ASSIGNMENT', NULL, 1771603486453, 1771603486453, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('6081c33642b645dd95a639dc6115a61d', '73d9f447e91e430dbc19e31270786774', 'cmls619wl0004i0uomiu228zk', 'python-demo-topic-under_assignment', 'UNDER_ASSIGNMENT', NULL, 1786207530459, 1786207530460, 1770655530459, NULL, NULL, NULL, 0, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('b2880566793740678315653e45a63c9d', 'b5074e39308f42399b2627b5bddf175e', 'cmls619wl0004i0uomiu228zk', 'python-demo-topic-active', 'ACTIVE', NULL, 1786207530463, 1786207530463, 1755103530463, NULL, NULL, NULL, 0, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('c9e5a3d586604e2aa905fc6733374db4', '64d2697371524517ba8ea54ff22c0b58', 'cmls619wl0004i0uomiu228zk', 'python-demo-topic-under_exam', 'UNDER_EXAM', NULL, 1786207530468, 1786207530468, 1739551530468, NULL, NULL, NULL, 1, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('badf4d8d5afc4aaf91bada030c524215', '53a6393043cb4d46b4a6ee04ddd19eaf', 'cmls619wl0004i0uomiu228zk', 'python-demo-topic-completed', 'COMPLETED', NULL, 1786207530473, 1786207530476, 1723999530473, NULL, NULL, 'https://nemertes.library.upatras.gr/demo-thesis', 1, NULL, NULL, NULL);
INSERT INTO "Thesis" ("id", "studentId", "supervisorId", "topicId", "status", "draftUrl", "createdAt", "updatedAt", "officialAssignedAt", "assignmentGsNumber", "assignmentGsYear", "finalRepositoryUrl", "gradingOpen", "cancellationGsNumber", "cancellationGsYear", "cancellationReason") VALUES ('9ad8fbeeda764d1a97f27d63a0d391ce', '5a859287f5ed49a2838c2006aa147d93', 'cmls619wl0004i0uomiu228zk', 'python-demo-topic-canceled', 'CANCELED', NULL, 1786207530478, 1786207530480, 1708447530478, NULL, NULL, NULL, 0, '42', 2026, 'Demo ακύρωση κατόπιν απόφασης ΓΣ');

INSERT INTO "ThesisHistory" ("id", "thesisId", "fromStatus", "toStatus", "actorUserId", "note", "createdAt") VALUES ('3b067198b5bb4700a7d245dade8b392c', '6081c33642b645dd95a639dc6115a61d', NULL, 'UNDER_ASSIGNMENT', 'cmls6mp0s0001i0nc5r8zscb6', 'Demo μετάβαση σε UNDER_ASSIGNMENT.', 1786207530461);
INSERT INTO "ThesisHistory" ("id", "thesisId", "fromStatus", "toStatus", "actorUserId", "note", "createdAt") VALUES ('000108663af74af7b668458982d3494d', 'b2880566793740678315653e45a63c9d', NULL, 'ACTIVE', 'cmls6mp0s0001i0nc5r8zscb6', 'Demo μετάβαση σε ACTIVE.', 1786207530466);
INSERT INTO "ThesisHistory" ("id", "thesisId", "fromStatus", "toStatus", "actorUserId", "note", "createdAt") VALUES ('3d6971ac12f14772b2a8740afcd822d4', 'c9e5a3d586604e2aa905fc6733374db4', NULL, 'UNDER_EXAM', 'cmls6mp0s0001i0nc5r8zscb6', 'Demo μετάβαση σε UNDER_EXAM.', 1786207530471);
INSERT INTO "ThesisHistory" ("id", "thesisId", "fromStatus", "toStatus", "actorUserId", "note", "createdAt") VALUES ('91bcba01f1ce439889716971e6ca9c99', 'badf4d8d5afc4aaf91bada030c524215', NULL, 'COMPLETED', 'cmls6mp0s0001i0nc5r8zscb6', 'Demo μετάβαση σε COMPLETED.', 1786207530477);
INSERT INTO "ThesisHistory" ("id", "thesisId", "fromStatus", "toStatus", "actorUserId", "note", "createdAt") VALUES ('5750c295740f4a9c8c05f1b3579eaecf', '9ad8fbeeda764d1a97f27d63a0d391ce', NULL, 'CANCELED', 'cmls6mp0s0001i0nc5r8zscb6', 'Demo μετάβαση σε CANCELED.', 1786207530480);

INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('seed-topic-1', 'Thesis Workflow Demo Topic', 'Seed topic used for local development', NULL, 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1771427229293);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('cmls7cwwq000zi0ag0l29g2bu', 'health', 'sd', NULL, 'AVAILABLE', 'cmls6mp130006i0ncsxo9nec9', 1771429451930);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('cmls7fl0j0013i0agx36ftwhg', 'fgnh', 'fghn', '/uploads/7418bff1-e20f-4cd7-93c1-29e12afd5395.pdf', 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1771429576484);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('cmlurgl3y0001i0rgaplrndqp', 'adx', 'desf', '/uploads/19f223e2-9e51-4657-9e28-17bf43a52840.pdf', 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1771584147933);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('cmluzabhx0005i0rgj7xiisc6', '1', '', NULL, 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1771597292469);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('cmluzkhfl0001i0houle6nnar', 'styhj', 'tyhhj', '/uploads/827fbd37-833c-4d8e-84f8-9d7d81442201.pdf', 'AVAILABLE', 'cmls6mp26000oi0ncrxl5cs7w', 1771597766722);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('cmluzs4260003i0hou4cmu6b7', '5', '', NULL, 'AVAILABLE', 'cmls6mp26000oi0ncrxl5cs7w', 1771598122638);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('cmlv0o38s001ji0hop2ei3cdj', 'euytj', 'rykm', NULL, 'AVAILABLE', 'cmls6mp1n000fi0ncb9pdwn26', 1771599614572);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('cmlv0ofqe001li0hoknfspeeu', '1', '', NULL, 'AVAILABLE', 'cmls6mp1n000fi0ncb9pdwn26', 1771599630759);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('cmlv2xcxw001ni0ho6s3zbbiq', '13', 'εφρω', '/uploads/b7c92aa9-0dc3-427e-8bc4-b47b55cce3f3.pdf', 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1771603406276);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('python-demo-topic-under_assignment', 'Demo διπλωματική - UNDER_ASSIGNMENT', 'Καθαρό παράδειγμα για την παρουσίαση της συγκεκριμένης κατάστασης.', NULL, 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1786207530456);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('python-demo-topic-active', 'Demo διπλωματική - ACTIVE', 'Καθαρό παράδειγμα για την παρουσίαση της συγκεκριμένης κατάστασης.', NULL, 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1786207530462);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('python-demo-topic-under_exam', 'Demo διπλωματική - UNDER_EXAM', 'Καθαρό παράδειγμα για την παρουσίαση της συγκεκριμένης κατάστασης.', NULL, 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1786207530467);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('python-demo-topic-completed', 'Demo διπλωματική - COMPLETED', 'Καθαρό παράδειγμα για την παρουσίαση της συγκεκριμένης κατάστασης.', NULL, 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1786207530472);
INSERT INTO "Topic" ("id", "title", "summary", "descriptionUrl", "status", "supervisorId", "createdAt") VALUES ('python-demo-topic-canceled', 'Demo διπλωματική - CANCELED', 'Καθαρό παράδειγμα για την παρουσίαση της συγκεκριμένης κατάστασης.', NULL, 'AVAILABLE', 'cmls619wl0004i0uomiu228zk', 1786207530478);

INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls619vs0000i0uo9xzmzj3x', 'sec@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'SECRETARIAT', 1771427229256);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls619wd0001i0uoqywe965u', 'prof1@uni.local', '$2a$10$irYZcqYu4o0fJPDxg42eaeB9N.A19k3Bz3giHHBQjUycfoksLVMUW', 'PROFESSOR', 1771427229278);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls619wh0002i0uoshf86ylm', 's1@uni.local', '$2a$10$irYZcqYu4o0fJPDxg42eaeB9N.A19k3Bz3giHHBQjUycfoksLVMUW', 'STUDENT', 1771427229282);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp0s0001i0nc5r8zscb6', 'prof001@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228652);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp0z0004i0ncsfbnfxz6', 'prof002@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228660);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp160007i0nc0jttdiyy', 'prof003@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228667);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp1c000ai0ncjxii4pge', 'prof004@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228673);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp1j000di0nc1vjgpu5i', 'prof005@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228680);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp1q000gi0nccarwu6ns', 'prof006@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228686);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp1x000ji0nc1yktyi51', 'prof007@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228693);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp23000mi0ncsu15ddk8', 'prof008@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228700);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp29000pi0nc0lo3ut0a', 'prof009@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228706);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp2f000si0ncquypha7u', 'prof010@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'PROFESSOR', 1771428228712);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp2m000vi0nc0h8essfb', 'student001@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228718);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp2s000yi0nc8oluzccz', 'student002@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228725);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp2y0011i0ncoekw5gyn', 'student003@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228731);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp340014i0ncfqxljtyb', 'student004@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228737);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp3a0017i0ncin6uj9zw', 'student005@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228743);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp3g001ai0ncggjqxk47', 'student006@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228749);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp3n001di0ncdrzslxy1', 'student007@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228755);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp3t001gi0nch19kyce0', 'student008@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228761);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp3z001ji0ncf22pfk3y', 'student009@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228768);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls6mp45001mi0ncywdanyd4', 'student010@uni.local', '$2a$10$Drid.vJSSqEE5beIWp7YWuLHYzt8dj5USgdzXyw.MS5HysKPkWTu6', 'STUDENT', 1771428228774);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls72hql0000i0ag1qm6osq7', 'maria.111111@uni.gr', '$2a$10$cZvfxryADmp.zxU1xnx5Ve80duqdRwc91FWhMYUJ7XINWF31pUarO', 'STUDENT', 1771428965710);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls72hra0003i0ago7cq1gq3', 'nikos.222222@uni.gr', '$2a$10$cZvfxryADmp.zxU1xnx5Ve80duqdRwc91FWhMYUJ7XINWF31pUarO', 'STUDENT', 1771428965735);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls72hrm0006i0agc78y4kvf', 'eleni.333333@uni.gr', '$2a$10$cZvfxryADmp.zxU1xnx5Ve80duqdRwc91FWhMYUJ7XINWF31pUarO', 'STUDENT', 1771428965747);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls72hrx0009i0ag6e160dlk', 'd.kostas@uni.gr', '$2a$10$cZvfxryADmp.zxU1xnx5Ve80duqdRwc91FWhMYUJ7XINWF31pUarO', 'PROFESSOR', 1771428965758);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls72hs7000ci0ag28j1f7lk', 's.mani@uni.gr', '$2a$10$cZvfxryADmp.zxU1xnx5Ve80duqdRwc91FWhMYUJ7XINWF31pUarO', 'PROFESSOR', 1771428965768);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('cmls72hsh000fi0ag0e4rrltl', 'g.lazarou@uni.gr', '$2a$10$cZvfxryADmp.zxU1xnx5Ve80duqdRwc91FWhMYUJ7XINWF31pUarO', 'PROFESSOR', 1771428965778);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('6bc7166e3fdc46749d7600f09c5caba2', 'demo.student001@uni.local', '$2b$10$0LSwyvTzp07n.3/uhE38iORmhPMMKOZovXKwFCy2zxRzL.RaoHXp2', 'STUDENT', 1786207530451);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('54785ed1a9ee4cd68f90e27c3b843153', 'demo.student002@uni.local', '$2b$10$0LSwyvTzp07n.3/uhE38iORmhPMMKOZovXKwFCy2zxRzL.RaoHXp2', 'STUDENT', 1786207530461);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('17069147f9764d59bf84a6956f6497b4', 'demo.student003@uni.local', '$2b$10$0LSwyvTzp07n.3/uhE38iORmhPMMKOZovXKwFCy2zxRzL.RaoHXp2', 'STUDENT', 1786207530467);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('a76475011b164d58aa0945a52ddda3b9', 'demo.student004@uni.local', '$2b$10$0LSwyvTzp07n.3/uhE38iORmhPMMKOZovXKwFCy2zxRzL.RaoHXp2', 'STUDENT', 1786207530472);
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt") VALUES ('1988f372ba814c01a60394270afca51e', 'demo.student005@uni.local', '$2b$10$0LSwyvTzp07n.3/uhE38iORmhPMMKOZovXKwFCy2zxRzL.RaoHXp2', 'STUDENT', 1786207530477);

CREATE INDEX "CommitteeInvitation_professor_status_idx" ON "CommitteeInvitation"("professorId", "status");
CREATE UNIQUE INDEX "CommitteeInvitation_thesisId_professorId_key" ON "CommitteeInvitation"("thesisId", "professorId");
CREATE INDEX "CommitteeMember_professor_idx" ON "CommitteeMember"("professorId");
CREATE UNIQUE INDEX "CommitteeMember_thesisId_professorId_key" ON "CommitteeMember"("thesisId", "professorId");
CREATE UNIQUE INDEX "Grade_thesisId_professorId_key" ON "Grade"("thesisId", "professorId");
CREATE INDEX "PresentationDetails_date_idx" ON "PresentationDetails"("date");
CREATE UNIQUE INDEX "PresentationDetails_thesisId_key" ON "PresentationDetails"("thesisId");
CREATE UNIQUE INDEX "Professor_code_key" ON "Professor"("code");
CREATE UNIQUE INDEX "Professor_userId_key" ON "Professor"("userId");
CREATE UNIQUE INDEX "Student_am_key" ON "Student"("am");
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE INDEX "ThesisHistory_thesis_created_idx" ON "ThesisHistory"("thesisId", "createdAt");
CREATE INDEX "ThesisMaterial_thesis_idx" ON "ThesisMaterial"("thesisId");
CREATE INDEX "ThesisNote_thesis_professor_idx" ON "ThesisNote"("thesisId", "professorId");
CREATE INDEX "Thesis_status_created_idx" ON "Thesis"("status", "createdAt");
CREATE UNIQUE INDEX "Thesis_studentId_key" ON "Thesis"("studentId");
CREATE UNIQUE INDEX "Thesis_topicId_key" ON "Thesis"("topicId");
CREATE INDEX "Topic_supervisor_status_idx" ON "Topic"("supervisorId", "status");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

COMMIT;
PRAGMA foreign_keys = ON;
