# Tandem Backend Class Diagram

```mermaid
classDiagram
    direction TB

    %% ============================================
    %% UTILS - Base Classes
    %% ============================================
    class Entity~State~ {
        <<abstract>>
        -state: State
        -changes: Map
        +get(key: K): State[K]
        +set(key: K, value: State[K])
        +isDirty(): boolean
        +getChanges(): Partial~State~
        +commit()
        +rollback()
        +getCommittedState(): State
    }

    %% ============================================
    %% AUTH MODULE
    %% ============================================
    class UserData {
        <<entity>>
        +id: string
        +name: string
        +email: string
        +emailVerified: boolean
        +image: string | null
        +createdAt: Date
        +updatedAt: Date
    }

    class User {
    }

    class IUserRepository {
        <<repository>>
        +getByUserId(userId: string): Promise~User | null~
            +create(user: UserData): Promise~User~
            +update(user: UserData): Promise~User~
            +delete(userId: string): Promise~void~
    }

    User --|> Entity : extends Entity~UserData~
    UserData <.. User : uses

        class AuthRouter {
            <<view>>
            +login(req, res)
            +logout(req, res)
            +register(req, res)
            +getProfile(req, res)
        }

    %% ============================================
    %% SESSION MODULE - Entities
    %% ============================================
    class SessionData {
        <<entity>>
        +sessionId: string
        +startTime: Date
        +scheduledDuration: string
        +state: SessionState
    }

    class Session {
        +startCheckin()
        +finish()
        +disconnect()
            +addParticipant(userId: string)
            +addTask(task: Task)
    }

    class SessionParticipantData {
        <<entity>>
        +userId: string
        +sessionId: string
        +state: SessionParticipantState
        +focusTimeSeconds: number
        +breakTimeSeconds: number
        +updatedAt?: Date
    }

    class SessionParticipant {
        +disconnect()
        +finish()
        +break()
        +work()
        +updateTime()
            +joinSession(sessionId: string)
    }

    class TaskData {
        <<entity>>
        +taskId: string
        +title: string
        +isComplete: boolean
        +userId: string
        +sessionId: string
    }

    class Task {
        +toggleTask(isComplete: boolean)
            +updateTitle(title: string)
    }

    class CheckinMessageData {
        <<entity>>
        +messageId: string
        +sessionId: string
        +userId: string
        +content?: string | null
        +image_url?: string | null
        +audio_url?: string | null
        +orderingSeq: number
    }

    class CheckinMessage {
        +setContent(content: string)
        +setImage(url: string)
        +setAudio(url: string)
    }

    class CheckinReportData {
        <<entity>>
        +reportId: string
        +sessionId: string
        +reviewerId: string
        +revieweeId: string
        +workProved: boolean
    }

    class CheckinReport {
        +setWorkProved(workProved: boolean)
    }

    Session --|> Entity : extends Entity~SessionData~
    SessionData <.. Session : uses
    SessionParticipant --|> Entity : extends Entity~SessionParticipantData~
    SessionParticipantData <.. SessionParticipant : uses
    Task --|> Entity : extends Entity~TaskData~
    TaskData <.. Task : uses
    CheckinMessage --|> Entity : extends Entity~CheckinMessageData~
    CheckinMessageData <.. CheckinMessage : uses
    CheckinReport --|> Entity : extends Entity~CheckinReportData~
    CheckinReportData <.. CheckinReport : uses

    %% ============================================
    %% GAMIFICATION MODULE - Entities
    %% ============================================
    class UserStatsData {
        <<entity>>
        +userId: string
        +level: number
        +currentXP: number
        +tillNextLevelXP: number
        +totalAchievements: number
        +currentCoins: number
        +totalCoins: number
        +totalFocusMinutes: number
        +totalBreakMinutes: number
        +totalSessionCount: number
        +disConnectedSessionCount: number
        +createdAt: Date
    }

    class UserStats {
        +add(field: T, value: number)
        +applySessionEffect(participant: SessionParticipant, worked: boolean)
            +getLevel(): number
            +addCoins(amount: number)
    }

    class AchievementData {
        <<entity>>
        +achievementId: string
        +name: string
        +description: string | null
    }

    class Achievement {
        +unlockForUser(userId: string)
    }

    class StoreItemState {
        <<entity>>
        +itemId: string
        +name: string
        +description?: string
        +price: number
    }

    class StoreItem {
        +purchase(userId: string)
    }

    class PurchaseState {
        <<entity>>
        +purchaseId: string
        +itemId: string
        +userId: string
        +createdAt: Date
    }

    class Purchase {
        +refund()
    }

    class UserAchievementData {
        <<entity>>
        +userId: string
        +achievementId: string
        +createdAt: Date
    }

    class UserAchievement {
        +assignToUser(userId: string)
    }

    class GamificationHistoryState {
        <<entity>>
        +userId: string
        +type: GamificationEventType
        +added_coins?: number
        +added_xp?: number
        +sessionId?: string
        +purchased?: string
        +achieved?: string
    }

    class GamificationHistory {
        +logEvent(event: GamificationEventType)
    }

    UserStats --|> Entity : extends Entity~UserStatsData~
    UserStatsData <.. UserStats : uses
    Achievement --|> Entity : extends Entity~AchievementData~
    AchievementData <.. Achievement : uses
    StoreItem --|> Entity : extends Entity~StoreItemState~
    StoreItemState <.. StoreItem : uses
    Purchase --|> Entity : extends Entity~PurchaseState~
    PurchaseState <.. Purchase : uses
    UserAchievement --|> Entity : extends Entity~UserAchievementData~
    UserAchievementData <.. UserAchievement : uses
    GamificationHistory --|> Entity : extends Entity~GamificationHistoryState~
    GamificationHistoryState <.. GamificationHistory : uses

    %% ============================================
    %% SESSION MODULE - Services
    %% ============================================
    class SessionService {
        <<controller>>
        +initializeSession(data: SessionCreation)
        +handleDisconnect(userId: string)
        +endSession(sessionId: string, connected?: boolean)
        +rejoinSession(userId: string, sessionId: string)
        +canReturn(userId: string)
            +getSessionById(sessionId: string)
            +addParticipantToSession(sessionId: string, userId: string)
    }

    class PeerMatchingService {
        <<controller>>
        +addMatchingRequest(request: MatchingRequest): boolean
        +removeRequest(userId: string): boolean
            +findMatchForUser(userId: string): Session | null
    }

    class SessionParticipantService {
        <<controller>>
        +createSessionParticipants()
        +handleDisconnect()
        +reconnect()
            +getParticipantById(userId: string, sessionId: string)
    }

    class TaskService {
        <<controller>>
        +createSessionTasks()
            +getTasksForSession(sessionId: string)
            +updateTask(taskId: string, data)
    }

    class CheckinService {
        <<controller>>
        +createCheckinTimer()
            +sendCheckinMessage(sessionId: string, userId: string, content: string)
    }

    class WSService {
        <<controller>>
            +sendMessage(userId: string, message: any)
    }

    class WebSocketRegistry {
        <<controller>>
        +broadcast()
        +broadcastToSession()
        +broadcastToOthers()
        +endUserConnection()
            +registerConnection(userId: string, socket)
    }

    class SessionCacheRegistry {
        <<controller>>
        +addSession()
        +getUserSessionId()
        +hasUser()
        +deleteSessionCache()
            +getSessionCache(sessionId: string)
    }

    class TicketService {
        <<controller>>
            +createTicket(userId: string, sessionId: string)
    }

        %% SESSION MODULE - Routers
        class SessionRouter {
            <<view>>
            +getSession(req, res)
            +createSession(req, res)
            +endSession(req, res)
        }
        class TaskRouter {
            <<view>>
            +getTasks(req, res)
            +addTask(req, res)
            +updateTask(req, res)
        }
        class ReportRouter {
            <<view>>
            +getReports(req, res)
            +submitReport(req, res)
        }

        %% SESSION MODULE - Repositories
        class SessionRepository {
            <<repository>>
            +findById(sessionId: string): Promise~Session | null~
            +findAll(): Promise~Session[]~
            +create(data: SessionData): Promise~Session~
            +update(session: Session): Promise~Session~
            +delete(sessionId: string): Promise~void~
        }
        class SessionParticipantRepository {
            <<repository>>
            +findById(userId: string, sessionId: string): Promise~SessionParticipant | null~
            +findAllBySession(sessionId: string): Promise~SessionParticipant[]~
            +create(data: SessionParticipantData): Promise~SessionParticipant~
            +update(participant: SessionParticipant): Promise~SessionParticipant~
            +delete(userId: string, sessionId: string): Promise~void~
        }
        class TaskRepository {
            <<repository>>
            +findById(taskId: string): Promise~Task | null~
            +findAllBySession(sessionId: string): Promise~Task[]~
            +create(data: TaskData): Promise~Task~
            +update(task: Task): Promise~Task~
            +delete(taskId: string): Promise~void~
        }
        class CheckinMessageRepository {
            <<repository>>
            +findById(messageId: string): Promise~CheckinMessage | null~
            +findAllBySession(sessionId: string): Promise~CheckinMessage[]~
            +create(data: CheckinMessageData): Promise~CheckinMessage~
            +update(message: CheckinMessage): Promise~CheckinMessage~
            +delete(messageId: string): Promise~void~
        }
        class CheckinReportRepository {
            <<repository>>
            +findById(reportId: string): Promise~CheckinReport | null~
            +findAllBySession(sessionId: string): Promise~CheckinReport[]~
            +create(data: CheckinReportData): Promise~CheckinReport~
            +update(report: CheckinReport): Promise~CheckinReport~
            +delete(reportId: string): Promise~void~
        }

    %% ============================================
    %% GAMIFICATION MODULE - Services
    %% ============================================
    class LevelService {
        <<controller>>
        +config: LevelConfig
        +xpForLevel(level: number): number
        +totalXpForLevel(level: number): number
        +getLevelFromTotalXp(totalXp: number)
        +handleXpGain(currentLevel, currentXpInLevel, addedXp)
        +calcSessionXp(focusSeconds, breakSeconds): number
            +getLevelConfig(): LevelConfig
    }

    class UserStatService {
        <<controller>>
        +updateStatWithEndedSession(sessionId: string)
        +getStatData(userId: string)
            +addCoinsToUser(userId: string, amount: number)
    }

    class AchievementService {
        <<controller>>
            +grantAchievement(userId: string, achievementId: string)
            +getAchievementsForUser(userId: string)
    }

    class StoreService {
        <<controller>>
        +calcSessionCoin()
            +purchaseItem(userId: string, itemId: string)
    }

        %% GAMIFICATION MODULE - Routers
        class GamificationRouter {
            <<view>>
            +getStats(req, res)
            +getAchievements(req, res)
            +purchaseItem(req, res)
        }

        %% GAMIFICATION MODULE - Repositories
        class AchievementRepository {
            <<repository>>
            +findById(achievementId: string): Promise~Achievement | null~
            +findAll(): Promise~Achievement[]~
            +create(data: AchievementData): Promise~Achievement~
            +update(achievement: Achievement): Promise~Achievement~
            +delete(achievementId: string): Promise~void~
        }
        class PurchaseRepository {
            <<repository>>
            +findById(purchaseId: string): Promise~Purchase | null~
            +findAllByUser(userId: string): Promise~Purchase[]~
            +create(data: PurchaseState): Promise~Purchase~
            +delete(purchaseId: string): Promise~void~
        }
        class StoreItemRepository {
            <<repository>>
            +findById(itemId: string): Promise~StoreItem | null~
            +findAll(): Promise~StoreItem[]~
            +create(data: StoreItemState): Promise~StoreItem~
            +update(item: StoreItem): Promise~StoreItem~
            +delete(itemId: string): Promise~void~
        }
        class UserAchievementRepository {
            <<repository>>
            +findByUserAndAchievement(userId: string, achievementId: string): Promise~UserAchievement | null~
            +findAllByUser(userId: string): Promise~UserAchievement[]~
            +create(data: UserAchievementData): Promise~UserAchievement~
            +delete(userId: string, achievementId: string): Promise~void~
        }
        class UserStatsRepository {
            <<repository>>
            +findByUserId(userId: string): Promise~UserStats | null~
            +create(data: UserStatsData): Promise~UserStats~
            +update(stats: UserStats): Promise~UserStats~
        }

    %% ============================================
    %% Service Dependencies
    %% ============================================
    SessionService ..> PeerMatchingService : uses
    SessionService ..> TaskService : uses
    SessionService ..> CheckinService : uses
    SessionService ..> WebSocketRegistry : uses
    SessionService ..> SessionParticipantService : uses
    SessionService ..> SessionCacheRegistry : uses
    SessionService ..> UserStatService : uses
    SessionService ..> Session : creates
    SessionService ..> SessionParticipant : manages

    PeerMatchingService ..> SessionService : calls initializeSession
    PeerMatchingService ..> WebSocketRegistry : uses

    %% Routers (views) relationships
    SessionRouter ..> SessionService : uses
    TaskRouter ..> TaskService : uses
    ReportRouter ..> SessionService : uses
    GamificationRouter ..> UserStatService : uses
    GamificationRouter ..> AchievementService : uses
    GamificationRouter ..> StoreService : uses

    %% Repositories relationships
    SessionService ..> SessionRepository : uses
    SessionService ..> SessionParticipantRepository : uses
    SessionService ..> TaskRepository : uses
    SessionService ..> CheckinMessageRepository : uses
    SessionService ..> CheckinReportRepository : uses
    TaskService ..> TaskRepository : uses
    SessionParticipantService ..> SessionParticipantRepository : uses
    CheckinService ..> CheckinMessageRepository : uses
    CheckinService ..> CheckinReportRepository : uses
    UserStatService ..> UserStatsRepository : uses
    AchievementService ..> AchievementRepository : uses
    AchievementService ..> UserAchievementRepository : uses
    StoreService ..> StoreItemRepository : uses
    StoreService ..> PurchaseRepository : uses

    UserStatService ..> LevelService : uses
    UserStatService ..> StoreService : uses
    UserStatService ..> UserStats : manages

    UserStats ..> LevelService : uses
    UserStats ..> StoreService : uses
    UserStats ..> SessionParticipant : references

    %% ============================================
    %% Domain Relationships
    %% ============================================
    Session "1" --> "*" SessionParticipant : has participants
    Session "1" --> "*" Task : has tasks
    Session "1" --> "*" CheckinMessage : has messages
    Session "1" --> "2" CheckinReport : has reports

    User "1" --> "1" UserStats : has stats
    User "1" --> "*" UserAchievement : unlocks
    User "1" --> "*" Purchase : makes
    User "1" --> "*" GamificationHistory : tracks history

    Achievement "1" <-- "*" UserAchievement : references
    StoreItem "1" <-- "*" Purchase : references
```

## Architecture Overview

| Layer | Purpose | Examples |
|-------|---------|----------|
| **Entities** | Domain objects with state management | `User`, `Session`, `UserStats`, `Task` |
| **Repositories** | Data access interfaces | `UserRepository`, `SessionRepository` |
| **Services** | Business logic modules | `SessionService`, `LevelService`, `PeerMatchingService` |

## Module Breakdown

### Auth Module
- **User** - Core user entity with profile data

### Session Module  
- **Session** - Focus session with state machine (running → checkin → finished)
- **SessionParticipant** - User participation tracking with time accumulation
- **Task** - User-defined tasks within a session
- **CheckinMessage** - Chat messages during checkin phase
- **CheckinReport** - Peer verification of work completion

### Gamification Module
- **UserStats** - XP, levels, coins, and session statistics
- **Achievement** - Unlockable achievements
- **StoreItem** - Purchasable items in store
- **Purchase** - User purchase records
- **GamificationHistory** - Event audit trail
