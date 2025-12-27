# Tandem System Use Cases

This document identifies 12 use cases from the Tandem system, categorized by complexity, with appropriate diagrams for each level.

---

## Simple Use Cases (CRC Cards)

Simple use cases involve single-class operations with minimal interactions.

### 1. User Registration / Authentication

**Description**: A new user registers or authenticates with the system.

| Class | Responsibilities | Collaborators |
|-------|------------------|---------------|
| **User** | - Store user profile data (id, name, email, image)<br>- Track verification status<br>- Manage timestamps | UserRepository |
| **UserRepository** | - Persist user data<br>- Retrieve user by ID | Database |

---

### 2. View Available Achievements

**Description**: A user views all available achievements in the system.

| Class | Responsibilities | Collaborators |
|-------|------------------|---------------|
| **Achievement** | - Store achievement metadata (id, name, description) | AchievementRepository |
| **AchievementService** | - Retrieve all achievements<br>- Format achievement data | Achievement, AchievementRepository |
| **AchievementRepository** | - Query achievements from database | Database |

---

### 3. Toggle Task Completion

**Description**: A user marks a task as complete or incomplete during a session.

| Class | Responsibilities | Collaborators |
|-------|------------------|---------------|
| **Task** | - Store task data (id, title, isComplete)<br>- Toggle completion status | TaskRepository |
| **TaskRepository** | - Persist task changes<br>- Retrieve tasks by session | Database |

---

### 4. View User Statistics

**Description**: A user views their gamification statistics (XP, level, coins).

| Class | Responsibilities | Collaborators |
|-------|------------------|---------------|
| **UserStats** | - Store user statistics (level, XP, coins, focus time)<br>- Track session counts | UserStatsRepository |
| **UserStatService** | - Retrieve user stat data<br>- Format response | UserStats, UserStatsRepository |
| **UserStatsRepository** | - Query user stats from database | Database |

---

## Moderate Use Cases (Communication Diagrams)

Moderate use cases involve multiple objects with synchronous message passing.

### 5. Request Peer Matching

**Description**: A user requests to be matched with a peer for a focus session.

```mermaid
graph LR
    subgraph "1: Request Peer Matching"
        U[User Client] -->|1: addMatchingRequest| PMS[PeerMatchingService]
        PMS -->|1.1: check exists| EM[exists Map]
        PMS -->|1.2: add to queue| RQ[requests Map]
        PMS -->|1.3: broadcast matching_pending| WSR[WebSocketRegistry]
        WSR -->|1.3.1: send| U
    end
```

---

### 6. Initialize Session

**Description**: When two users are matched, the system initializes a focus session.

```mermaid
graph TD
    subgraph "2: Initialize Session"
        PMS[PeerMatchingService] -->|1: initializeSession| SS[SessionService]
        SS -->|1.1: create| S[Session Entity]
        SS -->|1.2: save| SR[SessionRepository]
        SS -->|1.3: createSessionParticipants| SPS[SessionParticipantService]
        SPS -->|1.3.1: save| SPR[SessionParticipantRepo]
        SS -->|1.4: createSessionTasks| TS[TaskService]
        TS -->|1.4.1: save| TR[TaskRepository]
        SS -->|1.5: createCheckinTimer| CS[CheckinService]
        SS -->|1.6: addSession| SCR[SessionCacheRegistry]
        SS -->|1.7: broadcast start_session| WSR[WebSocketRegistry]
    end
```

---

### 7. Handle User Disconnect

**Description**: The system handles when a user disconnects during a session.

```mermaid
graph TD
    subgraph "3: Handle Disconnect"
        WS[WebSocket] -->|1: handleDisconnect| SS[SessionService]
        SS -->|1.1: removeRequest| PMS[PeerMatchingService]
        SS -->|1.2: getUserSessionId| SCR[SessionCacheRegistry]
        SS -->|1.3: getBySessionId| SR[SessionRepository]
        SS -->|1.4: handleDisconnect| SPS[SessionParticipantService]
        SPS -->|1.4.1: update state| SP[SessionParticipant]
        SPS -->|1.4.2: save| SPR[SessionParticipantRepo]
        SS -->|1.5: broadcastToSession| WSR[WebSocketRegistry]
        WSR -->|1.5.1: other_user_disconnected| OC[Other Clients]
    end
```

---

### 8. Rejoin Session

**Description**: A disconnected user rejoins an active session.

```mermaid
graph TD
    subgraph "4: Rejoin Session"
        U[User Client] -->|1: rejoinSession| SS[SessionService]
        SS -->|1.1: reconnect| SPS[SessionParticipantService]
        SS -->|1.2: getBySessionId| SR[SessionRepository]
        SS -->|1.3: getBySessionId| SPR[SessionParticipantRepo]
        SS -->|1.4: getBySessionId| TR[TaskRepository]
        SS -->|1.5: broadcast session_data| WSR[WebSocketRegistry]
        WSR -->|1.5.1: send| U
        SS -->|1.6: broadcastToOthers| WSR
        WSR -->|1.6.1: other_user_reconnected| OC[Other Clients]
    end
```

---

## Complex Use Cases (Sequence Diagrams)

Complex use cases involve multiple actors, asynchronous operations, and state transitions.

### 9. Complete Session Lifecycle

**Description**: Full flow from matching request through session completion.

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant U2 as User 2
    participant PMS as PeerMatchingService
    participant SS as SessionService
    participant CS as CheckinService
    participant WSR as WebSocketRegistry
    participant SCR as SessionCacheRegistry
    participant USS as UserStatService

    U1->>PMS: addMatchingRequest(request1)
    PMS->>WSR: broadcast(matching_pending)
    WSR-->>U1: matching_pending

    U2->>PMS: addMatchingRequest(request2)
    PMS->>WSR: broadcast(matching_pending)
    WSR-->>U2: matching_pending

    Note over PMS: Matching interval runs

    PMS->>SS: initializeSession(matched_users)
    SS->>SS: Create Session Entity
    SS->>SS: Create SessionParticipants
    SS->>SS: Create Tasks
    SS->>CS: createCheckinTimer(sessionId, duration)
    SS->>SCR: addSession(sessionId, userIds)
    SS->>WSR: broadcast(start_session)
    WSR-->>U1: start_session
    WSR-->>U2: start_session

    Note over U1,U2: Focus Session Running

    CS->>CS: Timer expires
    CS->>SS: startCheckin(sessionId)
    SS->>SCR: moveToCheckin(sessionId)
    SS->>WSR: broadcastToSession(checkin_start)
    WSR-->>U1: checkin_start
    WSR-->>U2: checkin_start

    U1->>CS: handleReport(sessionId, U1, U2, true)
    CS->>WSR: broadcastToOthers(checkin_report_sent)
    WSR-->>U2: checkin_report_sent

    U2->>CS: handleReport(sessionId, U2, U1, true)
    CS->>WSR: broadcastToOthers(checkin_report_sent)
    WSR-->>U1: checkin_report_sent

    CS->>SS: endSession(sessionId)
    SS->>WSR: broadcast(session_done)
    WSR-->>U1: session_done
    WSR-->>U2: session_done
    SS->>SCR: deleteSessionCache(sessionId)
    SS->>USS: updateStatWithEndedSession(sessionId)
```

---

### 10. Checkin Workflow with Messages

**Description**: Users exchange messages during checkin phase and submit peer reviews.

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant U2 as User 2
    participant CS as CheckinService
    participant CMR as CheckinMessageRepo
    participant CRR as CheckinReportRepo
    participant WSR as WebSocketRegistry
    participant SS as SessionService
    participant SCR as SessionCacheRegistry

    Note over U1,U2: Checkin Phase Started

    U1->>CS: sendMessage(sessionId, U1, 0, "Here's my progress")
    CS->>CMR: save(CheckinMessage)
    CS->>WSR: broadcastToSession(checkin_partner_message)
    WSR-->>U1: checkin_partner_message
    WSR-->>U2: checkin_partner_message

    U2->>CS: sendMessage(sessionId, U2, 1, "Great work!")
    CS->>CMR: save(CheckinMessage)
    CS->>WSR: broadcastToSession(checkin_partner_message)
    WSR-->>U1: checkin_partner_message
    WSR-->>U2: checkin_partner_message

    U1->>CS: handleReport(sessionId, U1, U2, true)
    CS->>CRR: save(CheckinReport)
    CS->>SCR: report(U1)
    CS->>WSR: broadcastToOthers(checkin_report_sent)
    WSR-->>U2: checkin_report_sent
    CS->>CS: testSessionOver(sessionId)

    U2->>CS: handleReport(sessionId, U2, U1, true)
    CS->>CRR: save(CheckinReport)
    CS->>SCR: report(U2)
    CS->>WSR: broadcastToOthers(checkin_report_sent)
    WSR-->>U1: checkin_report_sent
    CS->>CS: testSessionOver(sessionId)

    Note over CS: All participants reported

    CS->>SS: endSession(sessionId)
```

---

### 11. Session Statistics Calculation

**Description**: After session ends, the system calculates XP, coins, and updates user stats.

```mermaid
sequenceDiagram
    participant SS as SessionService
    participant USS as UserStatService
    participant SR as SessionRepository
    participant SPR as SessionParticipantRepo
    participant CRR as CheckinReportRepo
    participant USR as UserStatsRepository
    participant US as UserStats
    participant LS as LevelService
    participant STS as StoreService

    SS->>USS: updateStatWithEndedSession(sessionId)

    USS->>SR: getBySessionId(sessionId)
    SR-->>USS: Session

    USS->>SPR: getBySessionId(sessionId)
    SPR-->>USS: SessionParticipant[]

    USS->>CRR: getSessionReports(sessionId)
    CRR-->>USS: CheckinReport[]

    loop For each participant
        USS->>USR: get(userId)
        USR-->>USS: UserStats

        USS->>US: applySessionEffect(participant, workProved)

        Note over US: Calculate XP and Coins

        US->>LS: calcSessionXp(focusSeconds, breakSeconds)
        LS-->>US: xpGained

        US->>STS: calcSessionCoin(focusSeconds, breakSeconds)
        STS-->>US: coinsGained

        US->>LS: handleXpGain(level, currentXp, addedXp)
        LS-->>US: newLevel, newXp

        Note over US: Update all stat fields
    end

    USS->>USR: save(...userStats)
```

---

### 12. Multi-User Matching with Disconnect Recovery

**Description**: Complex scenario where users are matched, one disconnects, and the session handles graceful recovery.

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant U2 as User 2
    participant WS as WSService
    participant SS as SessionService
    participant PMS as PeerMatchingService
    participant SPS as SessionParticipantService
    participant SP as SessionParticipant
    participant SCR as SessionCacheRegistry
    participant WSR as WebSocketRegistry
    participant CS as CheckinService

    Note over U1,U2: Users are in active session

    U1->>WS: Connection Lost
    WS->>SS: handleDisconnect(U1)

    SS->>PMS: removeRequest(U1)
    PMS-->>SS: false (not in matching)

    SS->>SCR: getUserSessionId(U1)
    SCR-->>SS: sessionId

    SS->>SPS: handleDisconnect(session, U1)
    SPS->>SP: disconnect()
    SP->>SP: set state = "disconnected"

    SS->>WSR: broadcastToSession(other_user_disconnected)
    WSR-->>U2: other_user_disconnected

    Note over U2: U2 continues working alone

    U1->>WS: Reconnection
    U1->>SS: canReturn(U1)
    SS->>SCR: hasUser(U1)
    SCR-->>SS: true

    U1->>SS: rejoinSession(U1, sessionId)

    SS->>SPS: reconnect(U1)
    SPS->>SP: set state = "running"

    SS->>WSR: broadcast(U1, session_data)
    WSR-->>U1: session_data

    SS->>WSR: broadcastToOthers(U1, other_user_reconnected)
    WSR-->>U2: other_user_reconnected

    Note over U1,U2: Session continues normally

    Note over CS: Timer expires, checkin starts

    CS->>WSR: broadcastToSession(checkin_start)
    WSR-->>U1: checkin_start
    WSR-->>U2: checkin_start

    alt U1 disconnects again during checkin
        U1->>WS: Connection Lost
        WS->>SS: handleDisconnect(U1)

        Note over U2: U2 can use self-checkin

        U2->>CS: selfCheckin(sessionId, U2)
        CS->>CS: Verify only 1 connected
        CS->>WSR: broadcast(U2, self_checkin_done)
        WSR-->>U2: self_checkin_done
        CS->>SS: endSession(sessionId)
    end
```

---

## Summary

| Complexity | Use Case | Diagram Type |
|------------|----------|--------------|
| Simple | User Registration | CRC Card |
| Simple | View Available Achievements | CRC Card |
| Simple | Toggle Task Completion | CRC Card |
| Simple | View User Statistics | CRC Card |
| Moderate | Request Peer Matching | Communication Diagram |
| Moderate | Initialize Session | Communication Diagram |
| Moderate | Handle User Disconnect | Communication Diagram |
| Moderate | Rejoin Session | Communication Diagram |
| Complex | Complete Session Lifecycle | Sequence Diagram |
| Complex | Checkin Workflow with Messages | Sequence Diagram |
| Complex | Session Statistics Calculation | Sequence Diagram |
| Complex | Multi-User Matching with Disconnect Recovery | Sequence Diagram |
