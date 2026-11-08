/* ======================================================================================================================
   JUNGLE CAT  -  game code (one file: js/game.js)

   HOW THIS FILE IS ORGANISED (top to bottom)
     1. GAME SETTINGS      all speeds, times, sizes, hit points ... (change them here)
     2. Helpers, scores, logo, audio (sound effects + ProTracker MOD music player)
     3. Menus / screens (title, high score, game over, win with the crawl text)
     4. Picture loading (every graphic is listed once, see ASRC)
     5. Enemies: archers, gorilla, woman boss, chimp + coconuts, crocodiles, skeletons ...
     6. The hero: movement (upd), whip, jumping, climbing, swimming, vine swing, rope holes
     7. Level data (LV) - one long line on purpose: [kind, x, patrol-from, patrol-to, ground-y] lists
     8. Drawing (draw), main loop (loop), keyboard / mouse / touch input

   SHORT NAMES USED IN THE CODE (the code was written compactly; this is the dictionary)
     x      the drawing surface (canvas 2d context)          cam, camY   camera position (left edge / vertical)
     P      the hero (player): P.x P.y position, P.vx P.vy speed, P.hp health, P.face 1=right -1=left, P.on = standing
     G      the running game: G.score, G.gems, G.run (playing), G.pause, G.msg (message text)
     L, LV  the current level / the list of all levels:  L.s solids, L.w water, L.v vines, L.sw swing vines,
            L.hl rope holes, L.e enemies, L.it items, L.c checkpoints, L.g goal, L.W level width
     EN     all enemies of the level (e.k kind, e.x e.y position, e.hp hit points, e.d direction, e.dead)
     AR     flying arrows        PR  thrown knives        CC  flying coconuts        BB  boss bullets        PA  particles
     K      pressed keys (K.l K.r K.u K.d K.j K.jp = jump pressed ...)         T  tick counter (60 per second)
     AS     loaded pictures (named in ASRC)        A  audio state        MODP  the ProTracker music player
     dt     time step of one frame, 1 = one tick (1/60 s)

   ENEMY KINDS (e.k):  0 snake  1 bat  2 crocodile  3 raptor  4 lizard man  5 spider  6 dragonfly  7 armored beast
                       8 skeleton  9 archer 10 (enemy10)  10 gorilla  11 woman boss  12 chimp  13 archer 30 (enemy30)
   ====================================================================================================================== */
/* every picture the game creates is remembered, so the loading bar can show how many are ready */
window.JC_IMGS = [];
(function () {
    var O = window.Image;
    window.Image = function (w, h) {
        var im = new O(w, h);
        window.JC_IMGS.push(im);
        return im;
    };
    window.Image.prototype = O.prototype;
})();
(function () {
    /* ===================================================================================================================
       GAME SETTINGS  -  every number a human may want to change lives in this block (search for "GAME SETTINGS").
       Units: 1 unit = 1 pixel of the 320x240 game screen.  Time: 60 ticks = 1 second.  Speeds: units per tick.
       Quick finder for the speeds:  walking HERO_WALK_SPEED, swimming HERO_SWIM_SPEED, jumping HERO_JUMP_SPEED, falling
       HERO_GRAVITY, hero knife KNIFE_SPEED, enemy walking/flying SPEED_*, archer arrows ARC_SPEED / ARC2_SPEED, coconut CHM_FLY,
       boss bullets WB_SPEED / BOSS_BULLET_SPEED.
       =================================================================================================================== */

    /* ============ HERO MOVEMENT, JUMPING, CLIMBING, SWIMMING ============ */
    var HERO_WALK_SPEED = 0.65;                /* walking / running speed on the ground */
    var HERO_CROUCH_SPEED = 0.35;              /* walking speed while crouching */
    var HERO_SWIM_SPEED = 0.55;                /* swimming speed in the water (sideways) */
    /* sideways speed in the air = walk speed x this (the hero flies further in a jump) */
    var HERO_AIR_SPEED_FACTOR = 1.9;
    var HERO_ROPE_SPEED = 0.75;                /* speed while hanging on a rope hole */
    var HERO_CLIMB_SPEED = 0.7;                /* speed climbing up / down a vine */
    var HERO_JUMP_SPEED = 2.975;               /* start speed of a jump upwards */
    var HERO_GRAVITY = 0.095;                  /* falling: speed gained every tick */
    var HERO_MAX_FALL_SPEED = 4.5;             /* falling never gets faster than this */
    var HERO_CLIMB_JUMP_SPEED = 2.4;           /* jump off a vine */
    var HERO_CLIMB_TOP_HOP = 2;                /* little hop when she climbs over the top of a vine */
    var HERO_ROPE_HOP_UP = 1.6;                /* hop up at the end of a rope hole */
    var HERO_ROPE_HOP_SIDE = 0.65;             /* hop sideways at the end of a rope hole */
    var HERO_SPIKE_BOUNCE = 2.5;               /* bounce up after she touched spikes */
    var HERO_WATER_TICKS = 600;                /* ticks in the deep water until she is eaten / drowns (600 = 10 seconds) */
    var HERO_HURT_INVULN = 80;                 /* ticks she can not be hurt again after a hit */
    var SWIM_SINK = 0.04;                      /* swimming: she sinks by this every tick */
    var SWIM_DIVE = 0.1;                       /* swimming: extra downward push while the DOWN key is held */
    var SWIM_RISE = 0.18;                      /* swimming: upward push while UP / JUMP is held */
    var SWIM_MAX_UP = 1;                       /* swimming: fastest way up */
    var SWIM_MAX_DOWN = 0.8;                   /* swimming: fastest way down */
    /* width of the two posts at every rope hole (units); height follows the trunk picture's proportions. Was 7
       (fixed) for the old 26 px trunk */
    var HOLE_POST_W = 10;
    /* jumping/falling in slow motion: gravity x JUMP_SLOW^2, jump power and air speed x JUMP_SLOW = same height
       and same distance, but it takes 1/JUMP_SLOW times longer (1 = old speed) */
    var JUMP_SLOW = 0.704;
    /* all hero movement except running (crawl, swim, vine climb, rope-hang crossing) is this much of its old
       speed; 1 = old speed */
    var HERO_SLOW = 0.85;
    var VINE_G = 0.19;                         /* swing gravity of the swinging vines (was .38, faster). */
    /* swing gravity (was .38 = faster) and a launch boost so the jump distance stays the same */
    var VINE_LAUNCH = 1.41;
    /* running legs: pictures per step, 1 = old (looked slow motion), 1.4 = 24 pictures/second. Running SPEED is
       not changed. */
    var RUN_ANIM_K = 1.4;
    var HANG_K = 0.95;                         /* size of the vine-hang animation (1 = as exported) */
    var JV0 = 2.975 * JUMP_SLOW;               /* speed that means "start of the jump" (= the jump power, see 3.). */
    var JAPEX = 20;                            /* which picture (0-44) is shown at the top of the jump. */
    var JRATE = 1.7;                           /* max pictures per tick (higher = snappier changes). */
    /* launch speed, apex frame (0-based), max frames per tick, ground distance where the landing reach starts */
    var JLAND = 18;
    var RESP_SAFE = 1;
    var RESP_BACK = 34;
    var RESP_MAX = 260;
    var RESP_HOLE = 60;
    /* she respawns at least this many units (horizontally) away from every living enemy, so she comes back a bit
       BEFORE the enemies, never in front of one. */
    var RESP_ENEMY = 110;
    /* when she loses a heart to ANY enemy / arrow / coconut / boss (not only falling, crocodile, spikes) the
       screen fades out (FADE_OUT) */
    var RESP_HIT = 1;
    var FADE_OUT = 70;
    var FADE_IN = 45;
    var SWK = 1.12;                            /* size of the swimming picture. */
    var IK = 1.1;
    var HID_STEP = 110;                        /* hero idle: ticks one pose is held (the 6 new pictures play 1-2-3-4-5-6-5-4-3-2-1 ... and fade into each other). */
    var HID_FADE = 0;                          /* part of every step used to fade into the next picture (0 = hard cut, 1 = always fading). */
    var IW = 1.22;                             /* height / width factor of the idle pose. */
    var DUCK_K = 0.9;                          /* duck pose size */
    var CROUCH_ANIM = 1;                       /* 1 = new crouch-down animation, 0 = old single picture. */
    var CD_DN = 24;                            /* ticks to go down. */
    var CD_UP = 16;                            /* ticks to stand up. */
    var CD_DZ = 0.24;                          /* share of the time spent dissolving into the hold pose. */
    var CLIMB_ON = 1;                          /* 0 = old pose (run picture), 1 = the new climbing animation (33 pictures) */
    /* pictures per game tick while she climbs (60 ticks/s -> 30 pictures/s). Up = forward, */
    var CLIMB_FPT = 0.5;
    /* game units per picture pixel (size). CLIMB_AX / CLIMB_AY = point of the picture that sits on */
    var CLIMB_K = 0.165;
    var CLIMB_AX = 147;
    var CLIMB_AY = 315;
    var CLIMB_DY = 2;
    /* 0 = old pose (run picture + drawn arms), 1 = the hand-over-hand animation */
    var ROPE_ON = 1;
    /* pictures per game tick while she moves (60 ticks/s -> 42 pictures/s). Higher = faster hands. She moves .64
       units/tick on the rope; the video hands move slower, so a lower value looks calmer, a higher one looks like
       a scramble. */
    var ROPE_FPT = 0.7;
    /* game units per picture pixel (size of the animation). ROPE_AX / ROPE_AY = the point of */
    var ROPE_K = 0.16;
    var ROPE_AX = 120;
    var ROPE_AY = 31;
    var ROPE_TILT = 0.5;
    var VL_ON = 1;                             /* 0 = off (old behaviour). */
    /* game ticks per leap picture (19 pictures in about 32 ticks, the last one is held). */
    var VL_TPF = 1.7;
    /* extra ticks she stays crouched after landing before she stands up (0 when a direction key is held, then she
       goes straight on). */
    var VL_HOLD = 10;
    /* height of the body centre above her feet.                  VLD.k = .19     size (units per picture pixel);
       ax/ay = anchor per picture. */
    var VL_AY = 25;

    /* ============ HERO WEAPONS: WHIP, MACE, KNIFE ============ */
    var WHIP_COOLDOWN = 26;                    /* ticks before the next whip hit */
    var MACE_COOLDOWN = 18;                    /* ticks before the next mace hit */
    var KNIFE_COOLDOWN = 20;                   /* ticks before the next knife throw */
    var KNIFE_SPEED = 5;                       /* flying speed of a thrown knife (the hero's "bullet") */
    var KNIFE_LIFE = 80;                       /* ticks a knife flies before it disappears */
    var WH_T = 21;                             /* ticks of one whip swing (smaller = faster). */
    var WH_A0 = -1.55;                         /* start angle. */
    var WH_A1 = 0.5;                           /* end angle   (guide arc for jumps / hanging). */
    var WH_LAG = 0.38;                         /* how much the tip trails behind (the "crack"). */
    var WA_LAG = 2.5;                          /* same for the standing whip-attack pictures. */
    var WP_N = 22;
    var WP_ST = 1.656;
    var WP_HD = 4;
    var WP_G = 0.085;
    var WP_DAMP = 0.985;
    var WP_BEND = 0.2;
    var WP_DRV = 0.26;
    var WP_FADE = 30;
    var WP_W1 = 1.3;
    var WP_W2 = 0.55;
    var WP_HX = 7;
    var WP_HY = -24;

    /* ============ ENEMIES: WALKING / FLYING SPEED AND ATTACK ============ */
    var SPEED_SNAKE = 0.25;
    var SPEED_BAT = 0.35;                      /* flying */
    var SPEED_CROCODILE = 0.15;
    var SPEED_RAPTOR = 0.45;
    var SPEED_LIZARDMAN = 0.18;
    var SPEED_SPIDER = 0.3;
    var SPEED_DRAGONFLY = 0.5;                 /* flying */
    var SPEED_BEAST = 0.14;
    var SPEED_SKELETON = 0.22;
    var BAT_BOB_PERIOD = 16;                   /* the bat flies up and down: bigger = slower */
    var BAT_BOB_HEIGHT = 8;                    /* ... and this high (units) */
    var DRAGONFLY_BOB_PERIOD = 9;
    var DRAGONFLY_BOB_HEIGHT = 12;
    var ENEMY_RESPAWN_TICKS = 18000;           /* a killed enemy comes back after this many ticks (18000 = 5 minutes) - but only when you are more than 220 units away */
    var NEVER_RESPAWN = 1000000000000;         /* the gorilla and the woman boss use this: they never come back */
    var ATK_ON = 1;                            /* 1 = enemies play their attack animation, 0 = off. */
    var ATK_T = 44;                            /* length of the attack animation in ticks. */
    var ATK_CD = 150;                          /* ticks between two attack animations. */
    var ATK_RY = 34;                           /* height tolerance for starting the attack. */
    /* 1 = the long sword really hurts (in the last 2 attack pictures), 0 = it is only a picture. */
    var SK_HIT = 1;
    /* how far the sword reaches from the skeleton's centre (units). ATK_RX[8] = 48 is the distance at which he
       starts to swing. */
    var SK_REACH = 0;
    var SPK_ON = 1;
    var SPK_K = 0.2;
    var SPK_HIT = 10;

    /* ============ ARCHER 10 (enemy kind 9) ============ */
    var ARR_VOL = 1;
    var ARC_ON = 1;
    var ARC_HP = 4;                            /* hits to kill her (machete, whip or throwing knives each count 1) */
    var ARC_IDLE_LOOPS = 3;                    /* she plays her idle animation this many times, then does ONE attack (shoots one arrow), then idle again ... (replaces the old fixed time between arrows) */
    var ARC_IDLE_TPF = 4;                      /* ticks per idle picture (12 pictures: 4 -> one idle loop = 48 ticks = 0.8 s, 3 loops = 2.4 s) */
    var ARC_FADE = 3;                          /* idle -> attack: the first attack pictures fade in over this many pictures (0 = hard cut) */
    /* ticks per attack picture (25 pictures). Draw+shoot takes 25*3.6 = 90 ticks */
    var ARC_TPF = 3.6;
    /* picture at which the arrow leaves the bow (the game spawns the real arrow there) */
    var ARC_REL = 22;
    var ARC_RECOV = 16;
    var ARC_RANGE = 175;                       /* she starts shooting when you are closer than this many units */
    var ARC_SPEED = 1.5;                       /* arrow speed (units/tick). ARC_AIM = .3 how steeply she may aim up/down */
    var ARC_AIM = 0.3;
    /* drawn arrow length. ARC_K = .1548, ARC_AX/ARC_AY = size / feet anchor of her pictures */
    var ARC_LEN = 21;
    var ARC_K = 0.1703;
    var ARC_AX = 156;
    var ARC_AY = 316;
    var ARC_SX = 13.5;
    var ARC_SY = 45.4;

    /* ============ ARCHER 30 (enemy kind 13) ============ */
    var ARC2_ON = 1;                           /* 1 = she shoots, 0 = she only stands. */
    var ARC2_HP = 2;                           /* hits to kill her. */
    var ARC2_PERIOD = 300;                     /* ticks between two shots (5 s). */
    var ARC2_RANGE = 175;                      /* she starts shooting closer than this. */
    var ARC2_SPEED = 1.6;                      /* arrow speed. */
    var ARC2_AIM = 0.8;                        /* how steeply she may aim up/down (was .3 = arrows went straight past you when you stood higher or lower). */
    var ARC2_LEN = 24;                         /* arrow length (units). */
    var ARC2_THICK = 1.7;                      /* arrow thickness (1 = as drawn). */
    var ARC2_K = 0.129;                        /* size of the picture (bigger = taller girl). */
    var ARC2_AX = 102;
    var ARC2_AY = 374;
    var ARC2_SX = 9;
    var ARC2_SY = 43;
    var ARC2_BX = 138;
    var ARC2_BY = 440;
    var ARC2_REC = 20;
    var ARC2_SCORE = 250;                      /* points for a kill. */
    var ARC2_REL = 35;                         /* enemy 30 archer: attack picture (counted from 0) where the arrow leaves the bow */
    var ARC2_IT = 40;

    /* ============ GORILLA (enemy kind 10) ============ */
    var GOR_ON = 1;
    var GOR_HP = 6;                            /* hits to kill */
    var GOR_REACH = 137.5;                     /* longest jump (units; was 125, now 10% wider) */
    var GOR_M = 38 / 11.8;
    var GOR_JMIN = 2;
    var GOR_JMAX = 5;                          /* a visible gorilla hops 2 to 5 metres per jump (1 m = GOR_M units) */
    var GOR_CATCH = 5;                         /* OFF screen he runs this many times faster and jumps GOR_REACH far, so he always catches up with you */
    var GOR_STUCK = 90;                        /* off screen and no way forward (hole, wall) for this many ticks: he appears again on the ground behind you */
    var GOR_ARC = 44.9;                        /* jump height (was 34, then 37.4, now +20% more) */
    var GOR_UP = 26;                           /* highest step he can jump up */
    var GOR_DROP = 90;                         /* deepest drop he jumps down */
    var GOR_WATER = 205;                       /* ground lower than this is water */
    /* ticks per attack picture (jump speed; was 2.4, then 3, now half the speed again) */
    var GOR_TPF = 6;
    var GOR_F0 = 8;
    var GOR_FT = 17;
    var GOR_FL = 28;
    /* landing recovery before the rest (ticks, was 34). TPF, CD and REC are all doubled = the gorilla moves at
       half the speed (one jump cycle about 4.3 s). */
    var GOR_REC = 68;
    var GOR_CD = 68;                           /* rest between jumps (ticks, was 34) */
    var GOR_STOMP = 26;                        /* landing damage radius */
    var GOR_K = 0.192;                         /* size (units per picture pixel) */
    var GOR_AAX = 170;
    var GOR_AAY = 287.5;
    var GOR_IAX = 101.55;
    var GOR_IAY = 338.5;

    /* ============ WOMAN BOSS (enemy kind 11) AND BOSS BULLETS ============ */
    var WBS_VOL = 2;                           /* woman boss shot volume (was 1, now 100% louder) */
    /* ticks between two shots (120 = one shot every 2 seconds). Higher = easier. */
    var BOSS_FIRE_TICKS = 120;
    var BOSS_BULLET_SPEED = 1.3;               /* speed of the bullets (was 2.3). Lower = easier. */
    var WB_ON = 1;
    var WB_HP = 8;                             /* end boss hp:12 (+ hp0:12, in bossInit) */
    var WB_PERIOD = 120;                       /* ticks between shots (120 = every 2 seconds) */
    var WB_TPF = 5;                            /* ticks per attack picture (draw + aim + shoot = 50 ticks) */
    var WB_RANGE = 230;                        /* she starts shooting when you are closer than this */
    var WB_SPEED = 2.6;                        /* bullet speed */
    var WB_AIM = 0.18;
    var WB_REL = 5;
    var WB_IT = 7;
    var WB_K = 0.1735;                         /* size   WB_MX / WB_MY = muzzle position (35 / 40.6 units from her feet) */
    var WB_AX = 259;
    var WB_AY = 308;
    var WB_MX = 35;
    var WB_MY = 40.6;

    /* ============ CHIMP (enemy kind 12) AND COCONUTS ============ */
    var CHAT_VOL = 0.8;
    var CHM_ON = 1;
    var CHM_HP = 2;                            /* hits to kill him */
    var CHM_PERIOD = 300;                      /* ticks from one throw to the next (5 s) */
    var CHM_RANGE = 150;                       /* he throws when you are closer than this (units) */
    var CHM_TPF = 3.4;                         /* ticks per throw picture */
    var CHM_ITPF = 2.4;                        /* ticks per idle picture */
    var CHM_REL = 9;                           /* throw picture where the coconut leaves his hand */
    var CHM_FLY = 1.7;                         /* coconut speed (units per tick), CHM_GRAV = .05 gravity */
    var CHM_GRAV = 0.05;
    var CHM_K = 0.19;                          /* picture size (units per picture pixel) */
    var CHM_BODY = 11.5;                       /* how far his body hangs beside the vine */
    var CHM_LIFT = 26;                         /* height of his hit box above the ground */
    var CHM_TOPY = 16.3;
    var CHM_ROPE = 130;                        /* rope length above him */
    var CHM_W = 226;
    var CHM_H = 294;

    /* ============ PRINCESS AND VICTORY DANCE ============ */
    var DANCE_SCALE = 1.2;                     /* size of the victory dance (1 = same height as the idle pose) */
    var PIL_H = 70;
    var DANCE_ON = 1;                          /* 1 = the dance plays after the boss, 0 = no dance. */
    var DANCE_TPF = 2.5;                       /* ticks per picture (2.5 = the video's 24 pictures per second). */
    var DANCE_LOOPS = 3;                       /* how many times the dance is played. */
    var PR_ON = 1;
    var PR_K = 0.1985;                         /* size (units per picture pixel; the hero's dance is about .2) */
    var PR_X = 18041;
    var PR_FY = 129.5;                         /* where she stands (centre x / feet y) */
    var PR_DX = 42;                            /* distance between the two dancers */
    /* ---- END BOSS BACKGROUND SCENE (graphics/boss/captive_01..17.png, cut out of endanimation.gif, 100 ms per picture): a looping animation that plays BEHIND the end boss.
       CAP_ON 1/0, CAP_X = centre x (units), CAP_FY = y of the feet, CAP_K = units per picture pixel (picture is 200 x 409 -> .165 = 67 units tall; the screen shows y > ~103 at the boss), CAP_TPF = ticks per picture (6 = the gif's 10 pictures/s) ---- */
    var CAP_ON = 1;
    var CAP_X = 17862;
    var CAP_FY = 176;
    var CAP_K = 0.165;
    var CAP_TPF = 6;
    var CAP_ALPHA = 1;
    var CAP_VOL = 2;                           /* captive scene sound volume (was 1, now 100% louder); the scene's sound (audio/captive_scene.wav), played once at the start of every loop of the animation. 0 = silent */
    var AMB_VOL = 1;                           /* volume of the jungle ambience loop (audio/ambience.wav). 1 = as before, 0 = silent */
    var SFX_VOL = 1;                           /* volume of all beeps, clicks and pickups (the 8-bit WAV samples in audio/sfx/). 1 = as before, 0 = silent */
    var LIGHT_MODE = 0;                        /* 0 = automatic (light mode only in Firefox, which draws big canvases slowly), 1 = always on, 2 = always off. Light mode switches off the animated waterfall / lake colour effects and refreshes the lake less often. Needs a page reload (F5). */
    var PRH_ON = 1;
    var PRH_X = 18028.6;
    var PRH_FY = 131.9;
    var PRH_K = 0.13196;

    /* ============ ANIMATION FRAMES: how many pictures every animation has ============
       The pictures are numbered files in the graphics folder (01, 02, 03 ... or 1, 2, 3 for the enemies). Set the number to the number of files you have:
       a smaller number plays only the first pictures, a bigger number plays the new files you added (for a different game, replace the pictures and set the counts).
       If you give an animation MORE pictures than it had, the code adapts: tables that hold one number per picture (anchor points, timings) reuse their last entry for the new pictures,
       and a missing file is shown as an empty picture. Timing numbers that name a picture (ARC_REL, ARC2_REL, GOR_F0 / GOR_FT / GOR_FL, JAPEX, WB_REL) are picture numbers - move them with the animation. */
    var FRAMES_SNAKE_MOVE = 4;                 /* free */
    var FRAMES_SNAKE_ATTACK = 4;               /* free */
    var FRAMES_BAT_FLY = 4;                    /* free */
    var FRAMES_BAT_ATTACK = 4;                 /* free */
    var FRAMES_CROCODILE_SWIM = 4;             /* free (the swimming / walking pictures of the crocodile enemy) */
    var FRAMES_CROCODILE_ATTACK = 4;           /* free */
    var FRAMES_RAPTOR_RUN = 4;                 /* free */
    var FRAMES_RAPTOR_ATTACK = 4;              /* free */
    var FRAMES_LIZARDMAN_WALK = 4;             /* free */
    var FRAMES_LIZARDMAN_ATTACK = 4;           /* free */
    var FRAMES_SPIDER_WALK = 4;                /* free */
    var FRAMES_SPIDER_ATTACK = 4;              /* free */
    var FRAMES_DRAGONFLY_FLY = 4;              /* free */
    var FRAMES_DRAGONFLY_ATTACK = 4;           /* free */
    var FRAMES_BEAST_WALK = 4;                 /* free (armored beast) */
    var FRAMES_BEAST_ATTACK = 4;               /* free */
    var FRAMES_SKELETON_WALK = 36;             /* free */
    var FRAMES_SKELETON_ATTACK = 33;           /* graphics/enemy_anims/skeleton/skeleton_attack_01..33.webp: sword attack (wind-up, overhead, slash, back) */
    var SK_ATK_T = 80;                         /* skeleton attack: length of the whole sword animation in ticks (60 = 1 second) */
    var SK_HIT_FROM = 22;                      /* the sword hurts from this attack picture ... */
    var SK_HIT_TO = 26;                        /* ... to this one (the slash in front of him; 22-26 = the 5 pictures where the blade comes down and sweeps forward) */
    var SK_SND_FRAME = 13;                     /* the sword sound (audio/skeleton_attack.wav) starts at this attack picture, so its loudest part lands on the slash */
    var BOSS_WALK_TPF = 2.8;                   /* end boss walk: ticks per picture (bigger = slower legs; 2.8 = feet do not slide at his walking speed) */
    var FRAMES_BOSS_WALK = 81;                 /* graphics/boss/walk/bwalk_01..81.png: end boss walk cycle, both legs (loops) */
    var DANCE_SECONDS = 5;                     /* win dance picture (graphics/win_screen/win_dance.webp) is shown this many seconds before the win screen; space / enter / click skips it */
    var FRAMES_CAPTIVE = 17;                   /* graphics/boss/captive_01..17.png: loop behind the end boss */
    var FRAMES_ARCHER10_IDLE = 12;             /* archer_idle_01..12.webp, the idle loop of enemy 10 (played forward, then starts again) */
    var FRAMES_ARCHER10_ATTACK = 25;           /* linked: ARC_REL = the picture where the arrow leaves (22) */
    var FRAMES_ARCHER30_IDLE = 17;             /* free (played forward and backward) */
    var FRAMES_ARCHER30_ATTACK = 39;           /* linked: ARC2_D (ticks per picture) and the release picture (index 35 in archer2Upd) */
    var FRAMES_GORILLA_ATTACK = 30;            /* linked: the gorilla jump phases (GOR_ ... values) */
    var FRAMES_GORILLA_IDLE = 2;               /* free */
    var FRAMES_WOMANBOSS_ATTACK = 6;           /* linked: WB_SEQ list below */
    var FRAMES_WOMANBOSS_IDLE = 7;             /* linked: WB_IDLE list below */
    var FRAMES_CHIMP_HANG = 48;                /* free */
    var FRAMES_CHIMP_THROW = 12;               /* linked: CHM_AXT list (one number per picture) */
    var FRAMES_HERO_SWIM = 11;                 /* free */
    var FRAMES_HERO_HANG = 21;                 /* graphics/hero_hang/hang_01..21.png (cut out of hang_vine.zip, frames 20-40: both hands on the vine). linked: HANGD.grip list (one pair per picture) */
    var FRAMES_HERO_JUMP = 45;                 /* linked: JAPEX (apex picture) and the JD lists (one number per picture) */
    var FRAMES_HERO_WHIP_ATTACK = 11;          /* linked: WAD list */
    var FRAMES_HERO_CROUCH_DOWN = 5;           /* linked: CDD list */
    var FRAMES_HERO_CLIMB = 33;                /* free */
    var FRAMES_HERO_SWING_LEAP = 19;           /* linked: VLD list */
    var FRAMES_CLOUDS = 5;                     /* linked: CLS list */
    var FRAMES_PRINCESS_DANCE = 82;            /* free */
    var FRAMES_HERO_IDLE = 6;                  /* graphics/hero_idle/idle_new_01..06.png (played 1-2-3-4-5-6-5-4-3-2-1 ...) */
    var FRAMES_HERO_ROPE_HANG = 37;            /* graphics/hero_rope/rope_01..37.png: hanging below a rope */
    var FRAMES_HERO_CRAWL = 45;                /* crawl animation under logs */
    var FRAMES_HERO_DANCE = 90;                /* graphics/hero_dance/dance_01..90.png: victory dance */

    /* ============ RED DANGER GEMS (red gem with a warning sign) ============
       A red gem is a trap, not a treasure: touching it costs RED_GEM_DAMAGE hearts (then she is safe for HERO_HURT_INVULN ticks). She can jump over it.
       RED_GEMS lists every one as [x, y of the gem centre]: on the ground = ground height - 7, over a water hole = about 12 above the ground beside it
       (so a normal jump goes over it). Delete / add / move entries as you like. RED_GEMS_ON = 0 removes all of them. */
    var RED_GEMS_ON = 1;
    var RED_GEM_DAMAGE = 1;                    /* hearts lost when she touches a red gem */
    var RED_GEM_HIT = 6;                       /* half size of the dangerous part (units) around the gem centre */
    var RED_GEMS = [
        /* on the ground */
        [1266, 148], [3656, 165], [4768, 149], [5478, 169], [8358, 163], [9066, 163], [9900, 163], [11348, 162], [12068, 128], [14924, 183], [15798, 157],
        /* floating over the 3 small water holes she can jump across */
        [2025, 126], [4925, 126], [17615, 136]
    ];

    /* ============ SCREEN, CAMERA, CRAWL TEXT, MISC ============ */
    var CHEAT_KEYS = 0;                        /* 1 = test keys work while playing (5 = in front of an enemy 10 archer, 8 = enemy 30 archer, 7 = end boss, 6 = chimp, 0 = skeleton bridge, 9 = skip the dance); 0 = switched off for the final release (keys 9 = hero dance and 5 = in front of the first enemy 10 archer always stay on) */
    /* number of crawl pictures (47 originally; the last 2 were cut for a smooth loop). Change only if you
       add/remove pictures. */
    /* crawl animation speed: pictures per step of walking. Bigger = faster legs. */
    var CRAWL_K = 4.8;
    /* share of the bridge picture above the walking line (bigger = bridge sits higher, */
    var BR_ANCH = 0.76;
    var CL_ON = 1;
    var CL_ALPHA = 0.2;
    var CL_SPAN = 420;
    var CL_DRIFT = 0.03;
    /* height above the highest palm crown of the level (bigger = higher in the sky) */
    var CL_Y = 34;

    /* ============ EXPERT SETTINGS LIST (in game: SETTINGS > GRAPHICS > EXPERT SETTINGS) ============
       Every number of the settings above is listed here as [group, name, step, description] so it can be changed in the game with the arrow keys
       (UP / DOWN = choose, LEFT / RIGHT = change by "step", SHIFT = 10 times bigger steps, ENTER = back to the default).
       New settings only show up in the list if you add a line here. Changed values are remembered in the browser (localStorage); some of them need a page reload (F5) to take full effect. */
    var TUNE = [
        ["HERO MOVEMENT", "HERO_WALK_SPEED", 0.01, "walking / running speed on the ground"],
        ["HERO MOVEMENT", "HERO_CROUCH_SPEED", 0.01, "walking speed while crouching"],
        ["HERO MOVEMENT", "HERO_SWIM_SPEED", 0.01, "swimming speed in the water (sideways)"],
        ["HERO MOVEMENT", "HERO_AIR_SPEED_FACTOR", 0.1, "sideways speed in the air = walk speed x this (the hero flies further in a jump)"],
        ["HERO MOVEMENT", "HERO_ROPE_SPEED", 0.01, "speed while hanging on a rope hole"],
        ["HERO MOVEMENT", "HERO_CLIMB_SPEED", 0.01, "speed climbing up / down a vine"],
        ["HERO MOVEMENT", "HERO_JUMP_SPEED", 0.1, "start speed of a jump upwards"],
        ["HERO MOVEMENT", "HERO_GRAVITY", 0.001, "falling: speed gained every tick"],
        ["HERO MOVEMENT", "HERO_MAX_FALL_SPEED", 0.1, "falling never gets faster than this"],
        ["HERO MOVEMENT", "HERO_CLIMB_JUMP_SPEED", 0.1, "jump off a vine"],
        ["HERO MOVEMENT", "HERO_CLIMB_TOP_HOP", 1, "little hop when she climbs over the top of a vine"],
        ["HERO MOVEMENT", "HERO_ROPE_HOP_UP", 0.1, "hop up at the end of a rope hole"],
        ["HERO MOVEMENT", "HERO_ROPE_HOP_SIDE", 0.01, "hop sideways at the end of a rope hole"],
        ["HERO MOVEMENT", "HERO_SPIKE_BOUNCE", 0.1, "bounce up after she touched spikes"],
        ["HERO MOVEMENT", "HERO_WATER_TICKS", 10, "ticks in the deep water until she is eaten / drowns (600 = 10 seconds)"],
        ["HERO MOVEMENT", "HERO_HURT_INVULN", 5, "ticks she can not be hurt again after a hit"],
        ["HERO MOVEMENT", "SWIM_SINK", 0.001, "swimming: she sinks by this every tick"],
        ["HERO MOVEMENT", "SWIM_DIVE", 0.01, "swimming: extra downward push while the DOWN key is held"],
        ["HERO MOVEMENT", "SWIM_RISE", 0.01, "swimming: upward push while UP / JUMP is held"],
        ["HERO MOVEMENT", "SWIM_MAX_UP", 1, "swimming: fastest way up"],
        ["HERO MOVEMENT", "SWIM_MAX_DOWN", 0.01, "swimming: fastest way down"],
        ["HERO MOVEMENT", "HOLE_POST_W", 1, ""],
        ["HERO MOVEMENT", "JUMP_SLOW", 0.01, ""],
        ["HERO MOVEMENT", "HERO_SLOW", 0.01, ""],
        ["HERO MOVEMENT", "VINE_G", 0.01, "swing gravity of the swinging vines (was .38, faster)."],
        ["HERO MOVEMENT", "VINE_LAUNCH", 0.1, "swing gravity (was .38 = faster) and a launch boost so the jump distance stays the same"],
        ["HERO MOVEMENT", "RUN_ANIM_K", 0.1, ""],
        ["HERO MOVEMENT", "HANG_K", 0.01, "size of the vine-hang animation (1 = as exported)"],
        ["HERO MOVEMENT", "JAPEX", 1, "which picture (0-44) is shown at the top of the jump."],
        ["HERO MOVEMENT", "JRATE", 0.1, "max pictures per tick (higher = snappier changes)."],
        ["HERO MOVEMENT", "JLAND", 1, "launch speed, apex frame (0-based), max frames per tick, ground distance where the landing reach starts"],
        ["HERO MOVEMENT", "RESP_SAFE", 1, ""],
        ["HERO MOVEMENT", "RESP_BACK", 5, ""],
        ["HERO MOVEMENT", "RESP_MAX", 10, ""],
        ["HERO MOVEMENT", "RESP_HOLE", 5, ""],
        ["HERO MOVEMENT", "RESP_ENEMY", 10, ""],
        ["HERO MOVEMENT", "RESP_HIT", 1, ""],
        ["HERO MOVEMENT", "FADE_OUT", 5, ""],
        ["HERO MOVEMENT", "FADE_IN", 5, ""],
        ["HERO MOVEMENT", "SWK", 0.1, "size of the swimming picture."],
        ["HERO MOVEMENT", "IK", 0.1, ""],
        ["HERO MOVEMENT", "HID_STEP", 10, "hero idle: ticks one pose is held (the 6 new pictures play 1-2-3-4-5-6-5-4-3-2-1 ... and fade into each other)."],
        ["HERO MOVEMENT", "HID_FADE", 1, "part of every step used to fade into the next picture (0 = hard cut, 1 = always fading)."],
        ["HERO MOVEMENT", "IW", 0.1, "height / width factor of the idle pose."],
        ["HERO MOVEMENT", "DUCK_K", 0.01, "duck pose size"],
        ["HERO MOVEMENT", "CROUCH_ANIM", 1, "1 = new crouch-down animation, 0 = old single picture."],
        ["HERO MOVEMENT", "CD_DN", 5, "ticks to go down."],
        ["HERO MOVEMENT", "CD_UP", 1, "ticks to stand up."],
        ["HERO MOVEMENT", "CD_DZ", 0.01, "share of the time spent dissolving into the hold pose."],
        ["HERO MOVEMENT", "CLIMB_ON", 1, "0 = old pose (run picture), 1 = the new climbing animation (33 pictures)"],
        ["HERO MOVEMENT", "CLIMB_FPT", 0.01, "pictures per game tick while she climbs (60 ticks/s -> 30 pictures/s). Up = forward,"],
        ["HERO MOVEMENT", "CLIMB_K", 0.01, "game units per picture pixel (size). CLIMB_AX / CLIMB_AY = point of the picture that sits on"],
        ["HERO MOVEMENT", "CLIMB_AX", 10, ""],
        ["HERO MOVEMENT", "CLIMB_AY", 10, ""],
        ["HERO MOVEMENT", "CLIMB_DY", 1, ""],
        ["HERO MOVEMENT", "ROPE_ON", 1, "0 = old pose (run picture + drawn arms), 1 = the hand-over-hand animation"],
        ["HERO MOVEMENT", "ROPE_FPT", 0.01, ""],
        ["HERO MOVEMENT", "ROPE_K", 0.01, "game units per picture pixel (size of the animation). ROPE_AX / ROPE_AY = the point of"],
        ["HERO MOVEMENT", "ROPE_AX", 10, ""],
        ["HERO MOVEMENT", "ROPE_AY", 5, ""],
        ["HERO MOVEMENT", "ROPE_TILT", 0.01, ""],
        ["HERO MOVEMENT", "VL_ON", 1, "0 = off (old behaviour)."],
        ["HERO MOVEMENT", "VL_TPF", 0.1, "game ticks per leap picture (19 pictures in about 32 ticks, the last one is held)."],
        ["HERO MOVEMENT", "VL_HOLD", 1, ""],
        ["HERO MOVEMENT", "VL_AY", 5, ""],
        ["HERO WEAPONS", "WHIP_COOLDOWN", 5, "ticks before the next whip hit"],
        ["HERO WEAPONS", "MACE_COOLDOWN", 1, "ticks before the next mace hit"],
        ["HERO WEAPONS", "KNIFE_COOLDOWN", 1, "ticks before the next knife throw"],
        ["HERO WEAPONS", "KNIFE_SPEED", 1, "flying speed of a thrown knife (the hero's \"bullet\")"],
        ["HERO WEAPONS", "KNIFE_LIFE", 5, "ticks a knife flies before it disappears"],
        ["HERO WEAPONS", "WH_T", 5, "ticks of one whip swing (smaller = faster)."],
        ["HERO WEAPONS", "WH_A0", 0.1, "start angle."],
        ["HERO WEAPONS", "WH_A1", 0.01, "end angle (guide arc for jumps / hanging)."],
        ["HERO WEAPONS", "WH_LAG", 0.01, "how much the tip trails behind (the \"crack\")."],
        ["HERO WEAPONS", "WA_LAG", 0.1, "same for the standing whip-attack pictures."],
        ["HERO WEAPONS", "WP_N", 5, ""],
        ["HERO WEAPONS", "WP_ST", 0.1, ""],
        ["HERO WEAPONS", "WP_HD", 1, ""],
        ["HERO WEAPONS", "WP_G", 0.001, ""],
        ["HERO WEAPONS", "WP_DAMP", 0.01, ""],
        ["HERO WEAPONS", "WP_BEND", 0.01, ""],
        ["HERO WEAPONS", "WP_DRV", 0.01, ""],
        ["HERO WEAPONS", "WP_FADE", 5, ""],
        ["HERO WEAPONS", "WP_W1", 0.1, ""],
        ["HERO WEAPONS", "WP_W2", 0.01, ""],
        ["HERO WEAPONS", "WP_HX", 1, ""],
        ["HERO WEAPONS", "WP_HY", 5, ""],
        ["ENEMIES", "SPEED_SNAKE", 0.01, ""],
        ["ENEMIES", "SPEED_BAT", 0.01, "flying"],
        ["ENEMIES", "SPEED_CROCODILE", 0.01, ""],
        ["ENEMIES", "SPEED_RAPTOR", 0.01, ""],
        ["ENEMIES", "SPEED_LIZARDMAN", 0.01, ""],
        ["ENEMIES", "SPEED_SPIDER", 0.01, ""],
        ["ENEMIES", "SPEED_DRAGONFLY", 0.01, "flying"],
        ["ENEMIES", "SPEED_BEAST", 0.01, ""],
        ["ENEMIES", "SPEED_SKELETON", 0.01, ""],
        ["ENEMIES", "BAT_BOB_PERIOD", 1, "the bat flies up and down: bigger = slower"],
        ["ENEMIES", "BAT_BOB_HEIGHT", 1, "... and this high (units)"],
        ["ENEMIES", "DRAGONFLY_BOB_PERIOD", 1, ""],
        ["ENEMIES", "DRAGONFLY_BOB_HEIGHT", 1, ""],
        ["ENEMIES", "ENEMY_RESPAWN_TICKS", 50, "a killed enemy comes back after this many ticks (18000 = 5 minutes) - but only when you are more than 220 units away"],
        ["ENEMIES", "NEVER_RESPAWN", 50, "the gorilla and the woman boss use this: they never come back"],
        ["ENEMIES", "ATK_ON", 1, "1 = enemies play their attack animation, 0 = off."],
        ["ENEMIES", "ATK_T", 5, "length of the attack animation in ticks."],
        ["ENEMIES", "ATK_CD", 10, "ticks between two attack animations."],
        ["ENEMIES", "ATK_RY", 5, "height tolerance for starting the attack."],
        ["ENEMIES", "SK_HIT", 1, "1 = the long sword really hurts (only in the slash pictures SK_HIT_FROM to SK_HIT_TO), 0 = it is only a picture."],
        ["ENEMIES", "SK_REACH", 1, "extra reach in units added to the sword's hit zone (0 = exactly the blade in the picture)."],
        ["ENEMIES", "SK_ATK_T", 5, "skeleton: length of the whole sword attack animation in ticks (60 = 1 second)."],
        ["ENEMIES", "SK_HIT_FROM", 1, "skeleton: the sword hurts from this attack picture (1-33)."],
        ["ENEMIES", "SK_HIT_TO", 1, "skeleton: the sword hurts until this attack picture (1-33)."],
        ["ENEMIES", "SK_SND_FRAME", 1, "skeleton: the sword sound starts at this attack picture."],
        ["ENEMIES", "SPK_ON", 1, ""],
        ["ENEMIES", "SPK_K", 0.01, ""],
        ["ENEMIES", "SPK_HIT", 1, ""],
        ["ARCHER 10", "ARR_VOL", 1, ""],
        ["ARCHER 10", "ARC_ON", 1, ""],
        ["ARCHER 10", "ARC_HP", 1, "hits to kill her (machete, whip or throwing knives each count 1)"],
        ["ARCHER 10", "ARC_IDLE_LOOPS", 1, "she plays her idle animation this many times, then does ONE attack (shoots one arrow), then idle again ... (replaces the old fixed time between arr..."],
        ["ARCHER 10", "ARC_IDLE_TPF", 1, "ticks per idle picture (12 pictures: 4 -> one idle loop = 48 ticks = 0.8 s, 3 loops = 2.4 s)"],
        ["ARCHER 10", "ARC_FADE", 1, "idle -> attack: the first attack pictures fade in over this many pictures (0 = hard cut)"],
        ["ARCHER 10", "ARC_TPF", 0.1, "ticks per attack picture (25 pictures). Draw+shoot takes 25*3.6 = 90 ticks"],
        ["ARCHER 10", "ARC_REL", 5, "picture at which the arrow leaves the bow (the game spawns the real arrow there)"],
        ["ARCHER 10", "ARC_RECOV", 1, ""],
        ["ARCHER 10", "ARC_RANGE", 10, "she starts shooting when you are closer than this many units"],
        ["ARCHER 10", "ARC_SPEED", 0.1, "arrow speed (units/tick). ARC_AIM = .3 how steeply she may aim up/down"],
        ["ARCHER 10", "ARC_AIM", 0.01, ""],
        ["ARCHER 10", "ARC_LEN", 5, "drawn arrow length. ARC_K = .1548, ARC_AX/ARC_AY = size / feet anchor of her pictures"],
        ["ARCHER 10", "ARC_K", 0.01, ""],
        ["ARCHER 10", "ARC_AX", 10, ""],
        ["ARCHER 10", "ARC_AY", 10, ""],
        ["ARCHER 10", "ARC_SX", 1, ""],
        ["ARCHER 10", "ARC_SY", 1, ""],
        ["ARCHER 30", "ARC2_ON", 1, "1 = she shoots, 0 = she only stands."],
        ["ARCHER 30", "ARC2_HP", 1, "hits to kill her."],
        ["ARCHER 30", "ARC2_PERIOD", 10, "ticks between two shots (5 s)."],
        ["ARCHER 30", "ARC2_RANGE", 10, "she starts shooting closer than this."],
        ["ARCHER 30", "ARC2_SPEED", 0.1, "arrow speed."],
        ["ARCHER 30", "ARC2_AIM", 0.01, "how steeply she may aim up/down (was .3 = arrows went straight past you when you stood higher or lower)."],
        ["ARCHER 30", "ARC2_LEN", 5, "arrow length (units)."],
        ["ARCHER 30", "ARC2_THICK", 0.1, "arrow thickness (1 = as drawn)."],
        ["ARCHER 30", "ARC2_K", 0.01, "size of the picture (bigger = taller girl)."],
        ["ARCHER 30", "ARC2_AX", 10, ""],
        ["ARCHER 30", "ARC2_AY", 10, ""],
        ["ARCHER 30", "ARC2_SX", 1, ""],
        ["ARCHER 30", "ARC2_SY", 5, ""],
        ["ARCHER 30", "ARC2_BX", 10, ""],
        ["ARCHER 30", "ARC2_BY", 10, ""],
        ["ARCHER 30", "ARC2_REC", 1, ""],
        ["ARCHER 30", "ARC2_SCORE", 10, "points for a kill."],
        ["ARCHER 30", "ARC2_IT", 5, ""],
        ["GORILLA", "GOR_ON", 1, ""],
        ["GORILLA", "GOR_HP", 1, "hits to kill"],
        ["GORILLA", "GOR_REACH", 10, "longest jump (units; was 125, now 10% wider)"],
        ["GORILLA", "GOR_JMIN", 1, ""],
        ["GORILLA", "GOR_JMAX", 1, "a visible gorilla hops 2 to 5 metres per jump (1 m = GOR_M units)"],
        ["GORILLA", "GOR_CATCH", 1, "OFF screen he runs this many times faster and jumps GOR_REACH far, so he always catches up with you"],
        ["GORILLA", "GOR_STUCK", 5, "off screen and no way forward (hole, wall) for this many ticks: he appears again on the ground behind you"],
        ["GORILLA", "GOR_ARC", 1, "jump height (was 34, then 37.4, now +20% more)"],
        ["GORILLA", "GOR_UP", 5, "highest step he can jump up"],
        ["GORILLA", "GOR_DROP", 5, "deepest drop he jumps down"],
        ["GORILLA", "GOR_WATER", 10, "ground lower than this is water"],
        ["GORILLA", "GOR_TPF", 1, "ticks per attack picture (jump speed; was 2.4, then 3, now half the speed again)"],
        ["GORILLA", "GOR_F0", 1, ""],
        ["GORILLA", "GOR_FT", 1, ""],
        ["GORILLA", "GOR_FL", 5, ""],
        ["GORILLA", "GOR_REC", 5, ""],
        ["GORILLA", "GOR_CD", 5, "rest between jumps (ticks, was 34)"],
        ["GORILLA", "GOR_STOMP", 5, "landing damage radius"],
        ["GORILLA", "GOR_K", 0.01, "size (units per picture pixel)"],
        ["GORILLA", "GOR_AAX", 10, ""],
        ["GORILLA", "GOR_AAY", 10, ""],
        ["GORILLA", "GOR_IAX", 10, ""],
        ["GORILLA", "GOR_IAY", 10, ""],
        ["WOMAN BOSS", "WBS_VOL", 1, ""],
        ["WOMAN BOSS", "BOSS_FIRE_TICKS", 10, "ticks between two shots (120 = one shot every 2 seconds). Higher = easier."],
        ["WOMAN BOSS", "BOSS_BULLET_SPEED", 0.1, "speed of the bullets (was 2.3). Lower = easier."],
        ["SCREEN / MISC", "DANCE_SECONDS", 0.5, "seconds the win dance picture is shown before the win screen (space / enter / click skips it)"],
        ["WOMAN BOSS", "BOSS_WALK_TPF", 0.1, "end boss walk: ticks per picture (bigger = slower legs)"],
        ["WOMAN BOSS", "WB_ON", 1, ""],
        ["WOMAN BOSS", "WB_HP", 1, "end boss hp:12 (+ hp0:12, in bossInit)"],
        ["WOMAN BOSS", "WB_PERIOD", 10, "ticks between shots (120 = every 2 seconds)"],
        ["WOMAN BOSS", "WB_TPF", 1, "ticks per attack picture (draw + aim + shoot = 50 ticks)"],
        ["WOMAN BOSS", "WB_RANGE", 10, "she starts shooting when you are closer than this"],
        ["WOMAN BOSS", "WB_SPEED", 0.1, "bullet speed"],
        ["WOMAN BOSS", "WB_AIM", 0.01, ""],
        ["WOMAN BOSS", "WB_REL", 1, ""],
        ["WOMAN BOSS", "WB_IT", 1, ""],
        ["WOMAN BOSS", "WB_K", 0.01, "size WB_MX / WB_MY = muzzle position (35 / 40.6 units from her feet)"],
        ["WOMAN BOSS", "WB_AX", 10, ""],
        ["WOMAN BOSS", "WB_AY", 10, ""],
        ["WOMAN BOSS", "WB_MX", 5, ""],
        ["WOMAN BOSS", "WB_MY", 1, ""],
        ["CHIMP", "CHAT_VOL", 0.01, ""],
        ["CHIMP", "CHM_ON", 1, ""],
        ["CHIMP", "CHM_HP", 1, "hits to kill him"],
        ["CHIMP", "CHM_PERIOD", 10, "ticks from one throw to the next (5 s)"],
        ["CHIMP", "CHM_RANGE", 10, "he throws when you are closer than this (units)"],
        ["CHIMP", "CHM_TPF", 0.1, "ticks per throw picture"],
        ["CHIMP", "CHM_ITPF", 0.1, "ticks per idle picture"],
        ["CHIMP", "CHM_REL", 1, "throw picture where the coconut leaves his hand"],
        ["CHIMP", "CHM_FLY", 0.1, "coconut speed (units per tick), CHM_GRAV = .05 gravity"],
        ["CHIMP", "CHM_GRAV", 0.001, ""],
        ["CHIMP", "CHM_K", 0.01, "picture size (units per picture pixel)"],
        ["CHIMP", "CHM_BODY", 1, "how far his body hangs beside the vine"],
        ["CHIMP", "CHM_LIFT", 5, "height of his hit box above the ground"],
        ["CHIMP", "CHM_TOPY", 1, ""],
        ["CHIMP", "CHM_ROPE", 10, "rope length above him"],
        ["CHIMP", "CHM_W", 10, ""],
        ["CHIMP", "CHM_H", 10, ""],
        ["PRINCESS / DANCE", "DANCE_SCALE", 0.1, "size of the victory dance (1 = same height as the idle pose)"],
        ["PRINCESS / DANCE", "PIL_H", 5, ""],
        ["PRINCESS / DANCE", "DANCE_ON", 1, "1 = the dance plays after the boss, 0 = no dance."],
        ["PRINCESS / DANCE", "DANCE_TPF", 0.1, "ticks per picture (2.5 = the video's 24 pictures per second)."],
        ["PRINCESS / DANCE", "DANCE_LOOPS", 1, "how many times the dance is played."],
        ["PRINCESS / DANCE", "PR_ON", 1, ""],
        ["PRINCESS / DANCE", "PR_K", 0.01, "size (units per picture pixel; the hero's dance is about .2)"],
        ["PRINCESS / DANCE", "PR_X", 50, ""],
        ["PRINCESS / DANCE", "PR_FY", 10, "where she stands (centre x / feet y)"],
        ["PRINCESS / DANCE", "PR_DX", 5, "distance between the two dancers"],
        ["PRINCESS / DANCE", "CAP_ON", 1, ""],
        ["PRINCESS / DANCE", "CAP_X", 50, ""],
        ["PRINCESS / DANCE", "CAP_FY", 10, ""],
        ["PRINCESS / DANCE", "CAP_K", 0.01, ""],
        ["PRINCESS / DANCE", "CAP_TPF", 1, ""],
        ["PRINCESS / DANCE", "CAP_ALPHA", 1, ""],
        ["SCREEN / MISC", "AMB_VOL", 0.1, "volume of the jungle ambience loop (audio/ambience.wav: wind, insects, hum). 1 = as before, 0 = silent"],
        ["SCREEN / MISC", "SFX_VOL", 0.1, "volume of all beeps, clicks and pickups (the 8-bit WAV samples in audio/sfx/). 1 = as before, 0 = silent"],
        ["SCREEN / MISC", "LIGHT_MODE", 1, "0 = automatic (light mode only in Firefox, which draws big canvases slowly), 1 = always on, 2 = always off. Light mode switches off the animated waterfall / lake colour effects and refreshes the lake less often. Needs a page reload (F5)."],
        ["PRINCESS / DANCE", "CAP_VOL", 1, "volume of the scene's sound (audio/captive_scene.wav), played once at the start of every loop of the animation. 0 = silent"],
        ["PRINCESS / DANCE", "PRH_ON", 1, ""],
        ["PRINCESS / DANCE", "PRH_X", 1000, ""],
        ["PRINCESS / DANCE", "PRH_FY", 10, ""],
        ["PRINCESS / DANCE", "PRH_K", 0.01, ""],
        ["RED GEMS", "RED_GEMS_ON", 1, ""],
        ["RED GEMS", "RED_GEM_DAMAGE", 1, "hearts lost when she touches a red gem"],
        ["RED GEMS", "RED_GEM_HIT", 1, "half size of the dangerous part (units) around the gem centre"],
        ["SCREEN / MISC", "CHEAT_KEYS", 1, "1 = test keys work while playing (5 = in front of an enemy 10 archer, 8 = enemy 30 archer, 7 = end boss, 6 = chimp, 0 = skeleton bridge, 9 = skip t..."],
        ["SCREEN / MISC", "CRAWL_K", 0.1, "crawl animation speed: pictures per step of walking. Bigger = faster legs."],
        ["SCREEN / MISC", "BR_ANCH", 0.01, "share of the bridge picture above the walking line (bigger = bridge sits higher,"],
        ["SCREEN / MISC", "CL_ON", 1, ""],
        ["SCREEN / MISC", "CL_ALPHA", 0.01, ""],
        ["SCREEN / MISC", "CL_SPAN", 10, ""],
        ["SCREEN / MISC", "CL_DRIFT", 0.001, ""],
        ["SCREEN / MISC", "CL_Y", 5, "height above the highest palm crown of the level (bigger = higher in the sky)"],
        ["ANIMATION FRAMES", "FRAMES_SNAKE_MOVE", 1, "number of pictures of the animation \"snake move\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_SNAKE_ATTACK", 1, "number of pictures of the animation \"snake attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_BAT_FLY", 1, "number of pictures of the animation \"bat fly\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_BAT_ATTACK", 1, "number of pictures of the animation \"bat attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_CROCODILE_SWIM", 1, "number of pictures of the animation \"crocodile swim\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_CROCODILE_ATTACK", 1, "number of pictures of the animation \"crocodile attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_RAPTOR_RUN", 1, "number of pictures of the animation \"raptor run\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_RAPTOR_ATTACK", 1, "number of pictures of the animation \"raptor attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_LIZARDMAN_WALK", 1, "number of pictures of the animation \"lizardman walk\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_LIZARDMAN_ATTACK", 1, "number of pictures of the animation \"lizardman attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_SPIDER_WALK", 1, "number of pictures of the animation \"spider walk\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_SPIDER_ATTACK", 1, "number of pictures of the animation \"spider attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_DRAGONFLY_FLY", 1, "number of pictures of the animation \"dragonfly fly\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_DRAGONFLY_ATTACK", 1, "number of pictures of the animation \"dragonfly attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_BEAST_WALK", 1, "number of pictures of the animation \"beast walk\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_BEAST_ATTACK", 1, "number of pictures of the animation \"beast attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_SKELETON_WALK", 1, "number of pictures of the animation \"skeleton walk\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_SKELETON_ATTACK", 1, "number of pictures of the animation \"skeleton attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_BOSS_WALK", 1, "number of pictures of the animation \"end boss walk\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_CAPTIVE", 1, "number of pictures of the animation \"captive\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_ARCHER10_IDLE", 1, "number of pictures of the animation \"archer10 idle\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_ARCHER10_ATTACK", 1, "number of pictures of the animation \"archer10 attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_ARCHER30_IDLE", 1, "number of pictures of the animation \"archer30 idle\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_ARCHER30_ATTACK", 1, "number of pictures of the animation \"archer30 attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_GORILLA_ATTACK", 1, "number of pictures of the animation \"gorilla attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_GORILLA_IDLE", 1, "number of pictures of the animation \"gorilla idle\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_WOMANBOSS_ATTACK", 1, "number of pictures of the animation \"womanboss attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_WOMANBOSS_IDLE", 1, "number of pictures of the animation \"womanboss idle\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_CHIMP_HANG", 1, "number of pictures of the animation \"chimp hang\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_CHIMP_THROW", 1, "number of pictures of the animation \"chimp throw\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_SWIM", 1, "number of pictures of the animation \"hero swim\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_HANG", 1, "number of pictures of the animation \"hero hang\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_JUMP", 1, "number of pictures of the animation \"hero jump\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_WHIP_ATTACK", 1, "number of pictures of the animation \"hero whip attack\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_CROUCH_DOWN", 1, "number of pictures of the animation \"hero crouch down\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_CLIMB", 1, "number of pictures of the animation \"hero climb\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_SWING_LEAP", 1, "number of pictures of the animation \"hero swing leap\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_CLOUDS", 1, "number of pictures of the animation \"clouds\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_PRINCESS_DANCE", 1, "number of pictures of the animation \"princess dance\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_IDLE", 1, "number of pictures of the animation \"hero idle\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_ROPE_HANG", 1, "number of pictures of the animation \"hero rope hang\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_CRAWL", 1, "number of pictures of the animation \"hero crawl\" (the numbered files in the graphics folder). Needs a page reload (F5)."],
        ["ANIMATION FRAMES", "FRAMES_HERO_DANCE", 1, "number of pictures of the animation \"hero dance\" (the numbered files in the graphics folder). Needs a page reload (F5)."]
    ], TUNE_DEF = {}, TUNE_KEY = 'jungle-cat-expert-settings';
    function tuneGet(n) {
        return eval(n);
    }
    function tuneSet(n, v) {
        eval(n + ' = ' + v);
        JV0 = 2.975 * JUMP_SLOW;
    }
    TUNE.forEach(function (t) {
        TUNE_DEF[t[1]] = tuneGet(t[1]);
    });
    (function () {
        try {
            var sv = JSON.parse(localStorage.getItem(TUNE_KEY)) || {};
            Object.keys(sv).forEach(function (n) {
                if (n in TUNE_DEF && typeof sv[n] === 'number' && isFinite(sv[n]))
                    tuneSet(n, sv[n]);
            });
        } catch (e) {
        }
    }());
    var $ = function (s) {
            return document.querySelector(s);
        }, sc = $('#sc'), cv = $('#cv'), x = cv.getContext('2d'), W = 320, H = 240, R = Math.random;
    /* game resolution: the canvas is 1280x960 (set in index.html); all drawing code still uses the old 800x600 coordinates, every transform is simply multiplied by RS */
    var RS = cv.width / 800;
    (function () {
        var st = x.setTransform.bind(x);
        x.setTransform = function (a, b, c, d, e, f) {
            st(a * RS, b * RS, c * RS, d * RS, e * RS, f * RS);
        };
        x.setTransform(1, 0, 0, 1, 0, 0);
    }());
    var view = 'title', els = [].slice.call(document.querySelectorAll('[data-v]')), hl = -1, idx = 0, G = {}, raf = 0, last = 0, ini = [0, 0, 0], cur = 0;
    var KEY = 'jungle-cat-scores', scores;
    try {
        scores = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
    }
    if (!Array.isArray(scores) || !scores.length)
        scores = [
            ['JUN', 3000], ['GLE', 2200], ['CAT', 1500], ['ZOE', 900], ['MIA', 400]
        ];
    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(scores));
        } catch (e) {
        }
    }
    function pad(n) {
        return ('000000' + n).slice(-7);
    }
    /* ---- hero movement (units per tick; 1 unit = 1 pixel of the 320x240 game screen, 60 ticks = 1 second) ---- */
    /* ---- hero weapons ---- */
    /* ---- enemy walking / flying speed (units per tick); kinds 9-13 (archers, gorilla, boss, chimp) do not walk ---- */
    /* logo */
    var lg = $('#logo');
    'JUNGLE CAT'.split('').forEach(function (c, i) {
        var s = document.createElement('span');
        s.textContent = c === ' ' ? '\xA0' : c;
        s.style.setProperty('--i', i);
        lg.appendChild(s);
    });
    /* audio */
    /* Amiga ProTracker music */
    var CHATURL = 'audio/chimp_attack.wav', ARRURL = 'audio/enemy10_arrow-swish.wav', WBSURL = 'audio/womanboss_shot.wav', MODURL = 'audio/music.mod', WHIPURL = 'audio/whip.wav', DANCEURL = 'audio/dance.wav', HSCRURL2 = 'audio/hero_scream.wav', EDIEURL = 'audio/enemy10_die.wav', EBDIEURL = 'audio/endboss_die.wav', GRLURL = 'audio/gorilla_attack.wav', WBDIEURL = 'audio/womanboss_die.wav', CAPURL = 'audio/captive_scene.wav';
    /* ProTracker MOD player (4+ channels, Paula-style mixing, hard L-R-R-L panning with a little separation) */
    var MODP = function () {
        var CLOCK = 7093789.2, PT = [
                856,
                808,
                762,
                720,
                678,
                640,
                604,
                570,
                538,
                508,
                480,
                453,
                428,
                404,
                381,
                360,
                339,
                320,
                302,
                285,
                269,
                254,
                240,
                226,
                214,
                202,
                190,
                180,
                170,
                160,
                151,
                143,
                135,
                127,
                120,
                113
            ], SINE = [0, 24, 49, 74, 97, 120, 141, 161, 180, 197, 212, 224, 235, 244, 250, 253, 255, 253, 250, 244, 235, 224, 212, 197, 180, 161, 141, 120, 97, 74, 49, 24];
        var S = { ctx: null, dest: null, node: null, mod: null, on: false, sr: 44100, vol: 1 };
        function ftTable(ft) {
            var t = [], s = ft > 7 ? ft - 16 : ft, i;
            for (i = 0; i < 36; i++)
                t.push(Math.round(PT[i] * Math.pow(2, -s / 96)));
            return t;
        }
        var FT = [];
        for (var f = 0; f < 16; f++)
            FT.push(ftTable(f));
        function noteOf(p, ft) {
            var t = FT[ft], b = 0, bd = 1000000000, i;
            for (i = 0; i < 36; i++) {
                var d = Math.abs(t[i] - p);
                if (d < bd) {
                    bd = d;
                    b = i;
                }
            }
            return b;
        }
        function parse(buf) {
            var d = new Uint8Array(buf), m = {}, i, j, k, off = 20;
            m.title = String.fromCharCode.apply(null, d.subarray(0, 20)).replace(/\0.*$/, '');
            m.smp = [];
            for (i = 0; i < 31; i++) {
                var o = 20 + i * 30, len = (d[o + 22] << 8 | d[o + 23]) * 2, ft = d[o + 24] & 15, vol = Math.min(64, d[o + 25]), ls = (d[o + 26] << 8 | d[o + 27]) * 2, ll = (d[o + 28] << 8 | d[o + 29]) * 2;
                m.smp.push({ len: len, ft: ft, vol: vol, ls: ls, ll: ll, data: null });
            }
            m.songLen = d[950];
            m.order = d.subarray(952, 952 + 128);
            var sig = String.fromCharCode(d[1080], d[1081], d[1082], d[1083]);
            m.ch = 4;
            if (sig === '6CHN')
                m.ch = 6;
            else if (sig === '8CHN' || sig === 'OCTA' || sig === 'CD81')
                m.ch = 8;
            else if (/^\d\dCH$/.test(sig))
                m.ch = parseInt(sig, 10);
            var np = 0;
            for (i = 0; i < 128; i++)
                if (m.order[i] > np)
                    np = m.order[i];
            np++;
            m.np = np;
            m.pat = [];
            var p = 1084;
            for (i = 0; i < np; i++) {
                var rows = [];
                for (j = 0; j < 64; j++) {
                    var r = [];
                    for (k = 0; k < m.ch; k++) {
                        var a = d[p], b = d[p + 1], c = d[p + 2], e = d[p + 3];
                        p += 4;
                        r.push({ per: (a & 15) << 8 | b, smp: a & 240 | c >> 4, fx: c & 15, pr: e });
                    }
                    rows.push(r);
                }
                m.pat.push(rows);
            }
            for (i = 0; i < 31; i++) {
                var s = m.smp[i];
                if (s.len > 0) {
                    var a8 = new Int8Array(s.len);
                    for (j = 0; j < s.len; j++)
                        a8[j] = d[p + j] << 24 >> 24;
                    s.data = a8;
                    p += s.len;
                }
            }
            return m;
        }
        function newCh() {
            return {
                smp: 0,
                per: 0,
                bper: 0,
                vol: 0,
                pos: 0,
                on: false,
                tgt: 0,
                tps: 0,
                vs: 0,
                vd: 0,
                vp: 0,
                vw: 0,
                ts: 0,
                td: 0,
                tp: 0,
                tw: 0,
                off: 0,
                lr: 0,
                lc: 0,
                ft: 0,
                delay: -1,
                dn: null,
                oPer: 0,
                oVol: 0,
                gl: 0
            };
        }
        function reset() {
            var m = S.mod, i;
            S.ch = [];
            for (i = 0; i < m.ch; i++)
                S.ch.push(newCh());
            S.speed = 6;
            S.tempo = 125;
            S.tick = 0;
            S.row = 0;
            S.pos = 0;
            S.brk = -1;
            S.jmp = -1;
            S.pdel = 0;
            S.acc = 0;
            S.spt = 0;
        }
        function trigger(c, n) {
            var m = S.mod;
            if (n.smp) {
                var s = m.smp[n.smp - 1];
                if (s) {
                    c.smp = n.smp;
                    c.vol = s.vol;
                    c.ft = s.ft;
                }
            }
            if (n.per) {
                var fx = n.fx;
                if (fx === 3 || fx === 5) {
                    c.tgt = n.per ? FT[c.ft][noteOf(n.per, 0)] : 0;
                } else {
                    c.per = FT[c.ft][noteOf(n.per, 0)];
                    c.bper = c.per;
                    c.pos = c.off > 0 ? c.off : 0;
                    c.on = !!c.smp;
                    if (c.vw < 4)
                        c.vp = 0;
                    if (c.tw < 4)
                        c.tp = 0;
                }
            }
        }
        function doRow() {
            var m = S.mod, row = m.pat[m.order[S.pos]][S.row], i;
            for (i = 0; i < m.ch; i++) {
                var c = S.ch[i], n = row[i], fx = n.fx, pr = n.pr, x = pr >> 4, y = pr & 15;
                c.dn = null;
                if (fx === 9 && pr)
                    c.lr9 = pr;
                if (fx === 9)
                    c.off = (pr || c.lr9 || 0) * 256;
                if (fx === 14 && x === 13) {
                    c.delay = y;
                    c.dn = n;
                } else {
                    c.delay = -1;
                    trigger(c, n);
                }
                if (fx === 9 && c.on && c.smp) {
                    c.pos = c.off;
                }
                if (fx === 3) {
                    if (pr)
                        c.tps = pr;
                } else if (fx === 5) {
                }
                if (fx === 4) {
                    if (x)
                        c.vs = x;
                    if (y)
                        c.vd = y;
                }
                if (fx === 7) {
                    if (x)
                        c.ts = x;
                    if (y)
                        c.td = y;
                }
                if (fx === 12)
                    c.vol = Math.min(64, pr);
                else if (fx === 11) {
                    S.jmp = pr;
                } else if (fx === 13) {
                    S.brk = x * 10 + y;
                } else if (fx === 15) {
                    if (pr < 32) {
                        S.speed = pr || 1;
                    } else
                        S.tempo = pr;
                } else if (fx === 14) {
                    if (x === 1)
                        c.per = Math.max(113, c.per - y);
                    else if (x === 2)
                        c.per = Math.min(856, c.per + y);
                    else if (x === 4)
                        c.vw = y;
                    else if (x === 7)
                        c.tw = y;
                    else if (x === 5) {
                        c.ft = y;
                    } else if (x === 6) {
                        if (y === 0)
                            c.lr = S.row;
                        else {
                            if (c.lc === 0)
                                c.lc = y;
                            else
                                c.lc--;
                            if (c.lc > 0)
                                S.brk = -2, S.loopTo = c.lr;
                        }
                    } else if (x === 10)
                        c.vol = Math.min(64, c.vol + y);
                    else if (x === 11)
                        c.vol = Math.max(0, c.vol - y);
                    else if (x === 14)
                        S.pdel = y;
                }
            }
        }
        function doTick() {
            var m = S.mod, row = m.pat[m.order[S.pos]][S.row], i;
            for (i = 0; i < m.ch; i++) {
                var c = S.ch[i], n = row[i], fx = n.fx, pr = n.pr, x = pr >> 4, y = pr & 15, t = S.tick;
                if (t > 0) {
                    if (fx === 0 && pr) {
                        var nn = noteOf(c.bper || c.per, c.ft), a = t % 3 === 0 ? 0 : t % 3 === 1 ? x : y;
                        c.per = FT[c.ft][Math.min(35, nn + a)];
                    } else if (fx === 1)
                        c.per = Math.max(113, c.per - pr);
                    else if (fx === 2)
                        c.per = Math.min(856, c.per + pr);
                    else if (fx === 3 || fx === 5) {
                        if (c.tgt && c.per !== c.tgt) {
                            if (c.per > c.tgt)
                                c.per = Math.max(c.tgt, c.per - c.tps);
                            else
                                c.per = Math.min(c.tgt, c.per + c.tps);
                        }
                        if (fx === 5) {
                            if (x)
                                c.vol = Math.min(64, c.vol + x);
                            else
                                c.vol = Math.max(0, c.vol - y);
                        }
                    } else if (fx === 4 || fx === 6) {
                        c.vp = c.vp + c.vs & 63;
                        if (fx === 6) {
                            if (x)
                                c.vol = Math.min(64, c.vol + x);
                            else
                                c.vol = Math.max(0, c.vol - y);
                        }
                    } else if (fx === 7) {
                        c.tp = c.tp + c.ts & 63;
                    } else if (fx === 10) {
                        if (x)
                            c.vol = Math.min(64, c.vol + x);
                        else
                            c.vol = Math.max(0, c.vol - y);
                    } else if (fx === 14) {
                        if (x === 9 && y && t % y === 0) {
                            c.pos = 0;
                            c.on = !!c.smp;
                        } else if (x === 12 && t === y)
                            c.vol = 0;
                        else if (x === 13 && t === c.delay && c.dn) {
                            var d = c.dn;
                            c.dn = null;
                            d = Object.assign({}, d, { fx: 0 });
                            trigger(c, d);
                        }
                    }
                }
                var op = c.per, ov = c.vol;
                if (fx === 4 || fx === 6) {
                    op = c.per + (c.vp & 32 ? -1 : 1) * (SINE[c.vp & 31] * c.vd >> 7);
                }
                if (fx === 7) {
                    ov = Math.max(0, Math.min(64, c.vol + (c.tp & 32 ? -1 : 1) * (SINE[c.tp & 31] * c.td >> 6)));
                }
                c.oPer = Math.max(113, Math.min(856 * 2, op || 0));
                c.oVol = ov;
            }
        }
        function advance() {
            var m = S.mod;
            S.tick++;
            if (S.tick >= S.speed + S.pdel * S.speed) {
                S.tick = 0;
                S.pdel = 0;
                var np = S.pos, nr = S.row + 1;
                if (S.brk === -2) {
                    nr = S.loopTo;
                    S.brk = -1;
                } else if (S.jmp >= 0 || S.brk >= 0) {
                    if (S.jmp >= 0)
                        np = S.jmp;
                    else
                        np = S.pos + 1;
                    nr = S.brk >= 0 ? S.brk : 0;
                    if (nr > 63)
                        nr = 0;
                } else if (nr > 63) {
                    nr = 0;
                    np = S.pos + 1;
                }
                S.jmp = -1;
                if (S.brk !== -2)
                    S.brk = -1;
                if (np >= m.songLen) {
                    np = 0;
                }
                S.pos = np;
                S.row = nr;
                doRow();
            }
        }
        function render(L, R, n) {
            var m = S.mod, sr = S.sr, k = 0, i;
            while (k < n) {
                if (S.spt <= 0) {
                    if (S.first) {
                        doRow();
                        S.first = false;
                    }
                    doTick();
                    S.spt = sr * 2.5 / S.tempo;
                    S.curTick = true;
                }
                var cnt = Math.min(n - k, Math.ceil(S.spt));
                for (var j = 0; j < cnt; j++) {
                    var l = 0, r = 0;
                    for (i = 0; i < m.ch; i++) {
                        var c = S.ch[i];
                        if (!c.on || !c.smp || c.oPer <= 0)
                            continue;
                        var sm = m.smp[c.smp - 1];
                        if (!sm || !sm.data)
                            continue;
                        var ls = sm.ls, ll = sm.ll, loop = ll > 2, end = loop ? ls + ll : sm.len, idx = c.pos | 0, fr = c.pos - idx;
                        if (idx >= end) {
                            if (loop) {
                                c.pos = ls + (c.pos - ls) % ll;
                                idx = c.pos | 0;
                                fr = c.pos - idx;
                            } else {
                                c.on = false;
                                continue;
                            }
                        }
                        var i2 = idx + 1;
                        if (i2 >= end)
                            i2 = loop ? ls : idx;
                        var a = sm.data[idx], b = sm.data[i2], v = (a + (b - a) * fr) / 128 * (c.oVol / 64);
                        c.pos += CLOCK / (2 * c.oPer) / sr;
                        var side = (i & 3) === 0 || (i & 3) === 3 ? 0 : 1;
                        if (side === 0) {
                            l += v;
                            r += v * 0.22;
                        } else {
                            r += v;
                            l += v * 0.22;
                        }
                    }
                    var g = S.vol * 0.42;
                    L[k + j] = Math.max(-1, Math.min(1, l * g));
                    R[k + j] = Math.max(-1, Math.min(1, r * g));
                }
                k += cnt;
                S.spt -= cnt;
                if (S.spt <= 0) {
                    advance();
                }
            }
        }
        function load(buf) {
            S.mod = parse(buf);
            reset();
            S.first = true;
            S.spt = 0;
        }
        function init(ctx, dest, buf) {
            S.ctx = ctx;
            S.dest = dest;
            S.sr = ctx.sampleRate;
            load(buf);
            var node = ctx.createScriptProcessor(2048, 0, 2);
            node.onaudioprocess = function (e) {
                render(e.outputBuffer.getChannelData(0), e.outputBuffer.getChannelData(1), e.outputBuffer.length);
            };
            S.node = node;
        }
        function play() {
            if (!S.node || S.on)
                return;
            S.node.connect(S.dest);
            S.on = true;
        }
        function pause() {
            if (!S.node || !S.on)
                return;
            try {
                S.node.disconnect();
            } catch (e) {
            }
            S.on = false;
        }
        return {
            init: init,
            play: play,
            pause: pause,
            load: load,
            render: render,
            state: S,
            setRate: function (sr) {
                S.sr = sr;
            }
        };
    }();
    /* swing gravity (was .38 = faster) and a launch boost so the jump distance stays the same */
    var WHIPB = null;
    function audBuf(url, key) {
        if (window.JC_AUDIO && window.JC_AUDIO[key]) {
            var pb = atob(window.JC_AUDIO[key]), pu = new Uint8Array(pb.length), pi;
            for (pi = 0; pi < pb.length; pi++)
                pu[pi] = pb.charCodeAt(pi);
            return Promise.resolve(pu.buffer);
        }
        return fetch(url).then(function (r) {
            if (!r.ok)
                throw 0;
            return r.arrayBuffer();
        }).catch(function () {
            var b = window.JC_AUDIO && window.JC_AUDIO[key];
            if (!b)
                throw 0;
            var bin = atob(b), u = new Uint8Array(bin.length), i;
            for (i = 0; i < bin.length; i++)
                u[i] = bin.charCodeAt(i);
            return u.buffer;
        });
    }
    function whipLoad() {
        try {
            audBuf(WHIPURL, 'whip').then(function (buf) {
                A.ctx.decodeAudioData(buf, function (b) {
                    WHIPB = b;
                }, function () {
                });
            }).catch(function () {
            });
        } catch (e) {
        }
    }
    var DANCEB = null;
    function danceLoad() {
        try {
            audBuf(DANCEURL, 'dance').then(function (buf) {
                A.ctx.decodeAudioData(buf, function (b) {
                    DANCEB = b;
                }, function () {
                });
            }).catch(function () {
            });
        } catch (e) {
        }
    }
    var SKAURL = 'audio/skeleton_attack.wav', SKAB = null;
    var HDIEB = null, EDIEB = null, EBDIEB = null, GRLB = null, WBDIEB = null, CHATB = null, ARRB = null, WBSB = null, CAPB = null, CAPS = null;
    /* + chimp throws a coconut, archer shoots an arrow (swish), woman boss pistol shot */
    /* samples: hero scream (audio/hero_scream.wav), archer = enemy 10 death (audio/enemy10_die.wav), end boss death (audio/endboss_die.wav) */
    function decIn(url, key, set, alt) {
        audBuf(url, key).then(function (buf) {
            A.ctx.decodeAudioData(buf, set, function () {
                if (alt)
                    alt();
            });
        }).catch(function () {
            if (alt)
                alt();
        });
    }
    function dieLoad() {
        try {
            decIn(HSCRURL2, 'hero_scream', function (b) {
                HDIEB = b;
            });
            decIn(EDIEURL, 'enemy10_die', function (b) {
                EDIEB = b;
            });
            decIn(EBDIEURL, 'endboss_die', function (b) {
                EBDIEB = b;
            });
            sfxLoad();
            decIn(SKAURL, 'skeleton_attack', function (b) {
                SKAB = b;
            });
            decIn(GRLURL, 'gorilla_attack', function (b) {
                GRLB = b;
            });
            decIn(WBDIEURL, 'womanboss_die', function (b) {
                WBDIEB = b;
            });
            decIn(CHATURL, 'chimp_attack', function (b) {
                CHATB = b;
            });
            decIn(ARRURL, 'enemy10_arrow', function (b) {
                ARRB = b;
            });
            decIn(CAPURL, 'captive_scene', function (b) {
                CAPB = b;
            });
            decIn(WBSURL, 'womanboss_shot', function (b) {
                WBSB = b;
            });
        } catch (e) {
        }
    }
    function sampSnd(b, vol) {
        if (!A.ctx || !A.fx || !b)
            return false;
        var s = A.ctx.createBufferSource(), g = A.ctx.createGain();
        s.buffer = b;
        g.gain.value = vol;
        s.connect(g);
        g.connect(A.m);
        s.start(0);
        return true;
    }
    function danceSnd() {
        if (!A.ctx || !A.fx || !DANCEB)
            return;
        var s = A.ctx.createBufferSource(), g = A.ctx.createGain();
        s.buffer = DANCEB;
        g.gain.value = 1;
        s.connect(g);
        g.connect(A.m);
        s.start(0, 0, 3.75);
    }
    function whip() {
        if (!A.ctx || !A.fx)
            return;
        if (!WHIPB) {
            sfx(900, 0.1, 'sawtooth', 200);
            return;
        }
        var s = A.ctx.createBufferSource(), g = A.ctx.createGain();
        s.buffer = WHIPB;
        g.gain.value = 0.9;
        s.connect(g);
        g.connect(A.m);
        s.start(0, 0, 0.884);
    }
    var SETK = 'jungle-cat-settings', ST = { mus: true, fx: true };
    try {
        var s0 = JSON.parse(localStorage.getItem(SETK));
        if (s0) {
            ST.mus = s0.mus !== false;
            ST.fx = s0.fx !== false;
        }
    } catch (e) {
    }
    var A = { ctx: null, m: null, mus: ST.mus, fx: ST.fx };
    function aud() {
        try {
            if (!A.ctx) {
                A.ctx = new (window.AudioContext || window.webkitAudioContext)();
                A.m = A.ctx.createGain();
                A.m.gain.value = 1;
                A.lim = A.ctx.createDynamicsCompressor();
                A.lim.threshold.value = -3;
                A.lim.knee.value = 0;
                A.lim.ratio.value = 20;
                A.lim.attack.value = 0.002;
                A.lim.release.value = 0.12;
                A.m.connect(A.lim);
                A.lim.connect(A.ctx.destination);
                A.ae = A.ctx.createGain();
                A.ae.gain.value = A.fx ? 1 : 0;
                A.ae.connect(A.m);
                amb();
                try {
                    A.mg = A.ctx.createGain();
                    A.mg.gain.value = 1;
                    A.mg.connect(A.m);
                    audBuf(MODURL, 'mod').then(function (buf) {
                        MODP.init(A.ctx, A.mg, buf);
                        musOn();
                    }).catch(function () {
                    });
                    whipLoad();
                    danceLoad();
                    dieLoad();
                } catch (e) {
                }
            }
            if (A.ctx.state === 'suspended')
                A.ctx.resume();
        } catch (e) {
        }
        musOn();
    }
    function musOn() {
        if (!A.ctx || !A.mg)
            return;
        if (A.mus)
            MODP.play();
        else
            MODP.pause();
    }
    function scream() {
        if (!A.ctx || !A.fx)
            return;
        var c = A.ctx, t = c.currentTime, o = c.createOscillator(), o2 = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = 'sawtooth';
        o2.type = 'square';
        f.type = 'bandpass';
        f.frequency.value = 1500;
        f.Q.value = 1.1;
        o.frequency.setValueAtTime(760, t);
        o.frequency.exponentialRampToValueAtTime(330, t + 1.3);
        o2.frequency.setValueAtTime(1500, t);
        o2.frequency.exponentialRampToValueAtTime(520, t + 1.3);
        l.frequency.value = 7;
        lg.gain.value = 28;
        l.connect(lg);
        lg.connect(o.frequency);
        lg.connect(o2.frequency);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.13, t + 0.05);
        g.gain.linearRampToValueAtTime(0.09, t + 0.9);
        g.gain.linearRampToValueAtTime(0, t + 1.4);
        o.connect(f);
        o2.connect(f);
        f.connect(g);
        g.connect(A.m);
        [o, o2, l].forEach(function (q) {
            q.start(t);
            q.stop(t + 1.45);
        });
    }
    function noise() {
        var c = A.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < d.length; i++)
            d[i] = Math.random() * 2 - 1;
        var s = c.createBufferSource();
        s.buffer = b;
        s.loop = true;
        s.start();
        return s;
    }
    function osc(f, g, dest) {
        var c = A.ctx, o = c.createOscillator(), n = c.createGain();
        o.frequency.value = f;
        n.gain.value = g;
        o.connect(n);
        n.connect(dest);
        o.start();
        return n;
    }
    /* jungle ambience (wind, insects, hum): audio/ambience.wav = 8 s loop, 8-bit mono 12.5 kHz; the old generated version below is only the fallback */
    var AMB_GAIN = 0.1468;
    function amb() {
        decIn('audio/ambience.wav', 'ambience', function (b) {
            var s = A.ctx.createBufferSource(), g = A.ctx.createGain();
            s.buffer = b;
            s.loop = true;
            g.gain.value = AMB_GAIN * AMB_VOL;
            s.connect(g);
            g.connect(A.ae);
            s.start(0);
        }, ambSynth);
        bird();
    }
    function ambSynth() {
        var c = A.ctx, f = c.createBiquadFilter(), g = c.createGain(), h = c.createBiquadFilter(), hg = c.createGain();
        f.type = 'bandpass';
        f.frequency.value = 650;
        f.Q.value = 0.5;
        g.gain.value = 0.07;
        noise().connect(f);
        f.connect(g);
        g.connect(A.ae);
        osc(0.12, 0.04, g.gain);
        h.type = 'highpass';
        h.frequency.value = 5500;
        hg.gain.value = 0.015;
        noise().connect(h);
        h.connect(hg);
        hg.connect(A.ae);
        var kg = osc(4300, 0.006, A.ae);
        osc(11, 0.006, kg.gain);
        osc(58, 0.025, A.ae);
    }
    function bird() {
        setTimeout(bird, 2500 + R() * 5000);
        if (!A.ctx || !A.fx || document.hidden)
            return;
        if (BIRDB.length) {
            var bs = A.ctx.createBufferSource(), bg = A.ctx.createGain();
            bs.buffer = BIRDB[Math.floor(R() * BIRDB.length)];
            bg.gain.value = 0.0588 * SFX_VOL;
            bs.connect(bg);
            bg.connect(A.m);
            bs.start(0);
            return;
        }
        var c = A.ctx, t = c.currentTime, f = 2000 + R() * 1800, n = 2 + Math.floor(R() * 3);
        for (var i = 0; i < n; i++) {
            var o = c.createOscillator(), g = c.createGain(), s = t + i * 0.16;
            o.frequency.setValueAtTime(f, s);
            o.frequency.exponentialRampToValueAtTime(f * (1.3 + R() * 0.4), s + 0.1);
            g.gain.setValueAtTime(0, s);
            g.gain.linearRampToValueAtTime(0.05, s + 0.02);
            g.gain.linearRampToValueAtTime(0, s + 0.12);
            o.connect(g);
            g.connect(A.m);
            o.start(s);
            o.stop(s + 0.14);
        }
    }
    /* beeps / clicks / pickups are 8-bit mono 12.5 kHz WAV samples (audio/sfx/sfx_<freq>_<seconds>_<wave>_<slide>.wav); the old oscillator is only the fallback */
    var SFX_KEYS = ["70_0.5_sawtooth_30", "80_0.3_sawtooth_35", "120_0.1_square_60", "120_0.5_sawtooth_40", "150_0.1_sawtooth_70", "150_0.4_sawtooth_50", "160_0.08_sawtooth_90", "170_0.09_sawtooth_70", "180_0.3_sawtooth_60", "180_0.5_sawtooth_50", "200_0.1_square_90", "240_0.12_square_120", "250_0.2_sawtooth_90", "260_0.12_triangle_110", "260_0.14_square_50", "300_0.1_square_150", "300_0.18_square_700", "330_0.1_triangle_150", "400_0.12_square_300", "420_0.08_square_200", "440_0.03_square_0", "440_0.05_square_0", "500_0.03_square_0", "500_0.05_square_0", "500_0.15_square_900", "500_0.18_square_90", "520_0.04_square_0", "520_0.08_square_0", "520_0.12_triangle_180", "600_0.03_square_0", "600_0.1_square_900", "660_0.1_square_0", "700_0.08_square_300", "880_0.06_square_0", "880_0.15_square_0", "880_0.4_square_1760", "900_0.1_sawtooth_200", "900_0.2_square_0", "1000_0.08_square_500", "1200_0.06_sawtooth_300", "1200_0.12_square_1800"];
    var SFXB = {}, BIRDB = [];
    function sfxLoad() {
        SFX_KEYS.forEach(function (k) {
            decIn('audio/sfx/sfx_' + k + '.wav', 'sfx_' + k, function (b) {
                SFXB[k] = b;
            });
        });
        for (var i = 1; i <= 6; i++)
            (function (i) {
                decIn('audio/sfx/bird_' + i + '.wav', 'bird_' + i, function (b) {
                    BIRDB.push(b);
                });
            }(i));
    }
    function sfx(f, d, t, s) {
        if (!A.ctx || !A.fx)
            return;
        var sb = SFXB[[f, d, t || 'square', s || 0].join('_')];
        if (sb) {
            var sn = A.ctx.createBufferSource(), sg = A.ctx.createGain();
            sn.buffer = sb;
            sg.gain.value = 0.0706 * SFX_VOL;
            sn.connect(sg);
            sg.connect(A.m);
            sn.start(0);
            return;
        }
        var c = A.ctx, o = c.createOscillator(), g = c.createGain(), n = c.currentTime;
        o.type = t || 'square';
        o.frequency.setValueAtTime(f, n);
        if (s)
            o.frequency.exponentialRampToValueAtTime(s, n + d);
        g.gain.setValueAtTime(0.06, n);
        g.gain.exponentialRampToValueAtTime(0.001, n + d);
        o.connect(g);
        g.connect(A.m);
        o.start(n);
        o.stop(n + d);
    }
    /* views */
    /* ---- loading bar: after START the level waits until all pictures (and the sliced backgrounds) are ready ---- */
    function jcProgress() {
        var list = window.JC_IMGS.concat([].slice.call(document.querySelectorAll('img'))), done = 0, tot = list.length, i, k, im;
        for (i = 0; i < list.length; i++)
            if (list[i].complete)
                done++;
        if (window.createImageBitmap && L && L.bg)
            for (k = 0; k < L.bg.length; k++) {
                im = BGS[L.bg[k]];
                if (im && im.complete && im.naturalWidth) {
                    bgPrep(im);
                    tot += im._cn;
                    done += im._cf ? im._cn : im._ch.filter(Boolean).length;
                } else
                    tot += 15;
            }
        return tot ? Math.min(1, done / tot) : 1;
    }
    function jcGate(cb) {
        var t0 = Date.now(), ov = null, bar, pct;
        function poll() {
            if (view !== 'game') {
                if (ov)
                    ov.remove();
                return;
            }
            var p = jcProgress();
            if (p >= 1 || Date.now() - t0 > 90000) {
                if (ov)
                    ov.remove();
                cb();
                return;
            }
            if (!ov) {
                ov = document.createElement('div');
                ov.style.cssText = 'position:absolute;inset:0;z-index:60;background:#040b06;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4em;color:#ffc83d;font-size:max(10px,2.2cqw);text-shadow:2px 2px 0 #000';
                ov.innerHTML = '<div>LOADING JUNGLE ...</div><div style="width:56%;height:1.6em;border:3px solid #7cf000;box-shadow:0 0 0 3px #000,0 0 18px #7cf00055;background:#0a1a0e;padding:3px;box-sizing:border-box"><div class="jcb" style="height:100%;width:0;background:linear-gradient(#b6ff4a,#4aa800)"></div></div><div class="jcp">0%</div>';
                sc.appendChild(ov);
                bar = ov.querySelector('.jcb');
                pct = ov.querySelector('.jcp');
            }
            bar.style.width = Math.round(p * 100) + '%';
            pct.textContent = Math.round(p * 100) + '%';
            setTimeout(poll, 60);
        }
        poll();
    }
    function show(v) {
        if (v === 'menu')
            v = 'title';
        view = v;
        sc.dataset.view = v;
        els.forEach(function (e) {
            e.hidden = e.dataset.v.split(' ').indexOf(v) < 0;
        });
        if (v === 'title') {
            lg.classList.remove('go');
            void lg.offsetWidth;
            lg.classList.add('go');
            $('#start').focus({ preventScroll: true });
        }
        if (NAV[v]) {
            idx = 0;
            paint();
        }
        if (v === 'tune')
            tunePaint();
        if (v === 'scores') {
            renderScores();
            $('#sPlay').focus({ preventScroll: true });
        }
    }
    var mainBtns = [].slice.call(document.querySelectorAll('#menu button')), setBtns = [].slice.call(document.querySelectorAll('#setMenu button')), sndBtns = [].slice.call(document.querySelectorAll('#sndMenu button')), gfxBtns = [].slice.call(document.querySelectorAll('#gfxMenu button')), quitBtns = [].slice.call(document.querySelectorAll('#quitMenu button'));
    var NAV = {
            title: function () {
                return [$('#start')].concat(mainBtns);
            },
            settings: function () {
                return setBtns;
            },
            sound: function () {
                return sndBtns;
            },
            gfx: function () {
                return gfxBtns;
            },
            quit: function () {
                return quitBtns;
            }
        }, BACKTO = { settings: 'menu', sound: 'settings', gfx: 'settings', quit: 'menu' };
    function navList() {
        var f = NAV[view];
        return f ? f() : [];
    }
    function paint() {
        var l = navList();
        l.forEach(function (b, i) {
            var on = i === idx;
            b.classList.toggle('on', on);
            if (b.parentNode && b.parentNode.tagName === 'LI')
                b.parentNode.classList.toggle('on', on);
        });
        if (l[idx])
            l[idx].focus({ preventScroll: true });
    }
    [$('#start')].concat(mainBtns, setBtns, sndBtns, gfxBtns, quitBtns).forEach(function (b) {
        b.onmouseenter = function () {
            var l = navList(), i = l.indexOf(b);
            if (i >= 0) {
                idx = i;
                paint();
            }
        };
    });
    function sndLabels() {
        sndBtns[0].textContent = 'MUSIC: ' + (A.mus ? 'ON' : 'OFF');
        sndBtns[1].textContent = 'EFFECTS: ' + (A.fx ? 'ON' : 'OFF');
    }
    function saveSet() {
        try {
            localStorage.setItem(SETK, JSON.stringify({ mus: A.mus, fx: A.fx }));
        } catch (e) {
        }
    }
    $('#start').onclick = function () {
        sfx(880, 0.15);
        startGame();
    };
    mainBtns[0].onclick = function () {
        sfx(660, 0.1);
        hl = -1;
        show('scores');
    };
    mainBtns[1].onclick = function () {
        sfx(660, 0.1);
        show('settings');
    };
    mainBtns[2].onclick = function () {
        sfx(660, 0.1);
        try {
            window.close();
        } catch (e) {
        }
        show('quit');
    };
    setBtns[0].onclick = function () {
        sfx(660, 0.1);
        show('sound');
    };
    setBtns[1].onclick = function () {
        sfx(660, 0.1);
        show('gfx');
    };
    setBtns[2].onclick = function () {
        sfx(520, 0.08);
        show('menu');
    };
    sndBtns[0].onclick = function () {
        A.mus = !A.mus;
        aud();
        musOn();
        saveSet();
        sndLabels();
        sfx(660, 0.1);
    };
    sndBtns[1].onclick = function () {
        A.fx = !A.fx;
        aud();
        if (A.ae)
            A.ae.gain.value = A.fx ? 1 : 0;
        saveSet();
        sndLabels();
        sfx(660, 0.1);
    };
    sndBtns[2].onclick = function () {
        sfx(520, 0.08);
        show('settings');
    };
    gfxBtns[0].onclick = function () {
        sfx(660, 0.1);
        show('tune');
    };
    gfxBtns[1].onclick = function () {
        sfx(520, 0.08);
        show('settings');
    };
    /* ---- EXPERT SETTINGS screen: list of every number in TUNE, UP/DOWN choose, LEFT/RIGHT change, ENTER default ---- */
    var tuneI = 0, TUNE_ROWS = 11, TUNE_N = TUNE.length + 1, TUNE_FLAG = {}, TUNE_DEC = {};
    TUNE.forEach(function (t) {
        TUNE_FLAG[t[1]] = (TUNE_DEF[t[1]] === 0 || TUNE_DEF[t[1]] === 1) && /(_ON|_KEYS)$/.test(t[1]);
        TUNE_DEC[t[1]] = (String(t[2]).split('.')[1] || '').length;
    });
    function tuneSave() {
        var o = {};
        TUNE.forEach(function (t) {
            var v = tuneGet(t[1]);
            if (v !== TUNE_DEF[t[1]])
                o[t[1]] = v;
        });
        try {
            localStorage.setItem(TUNE_KEY, JSON.stringify(o));
        } catch (e) {
        }
    }
    function tuneFmt(v) {
        return String(Math.round(v * 1e6) / 1e6);
    }
    function tuneChange(t, dir, big) {
        var n = t[1], v = tuneGet(n), nv;
        if (TUNE_FLAG[n])
            nv = v ? 0 : 1;
        else {
            nv = +(v + dir * t[2] * (big ? 10 : 1)).toFixed(TUNE_DEC[n] + 1);
            if (TUNE_DEF[n] > 0)
                nv = Math.max(t[2], nv);
        }
        tuneSet(n, nv);
        tuneSave();
    }
    function tunePaint() {
        var first = Math.max(0, Math.min(TUNE_N - TUNE_ROWS, tuneI - (TUNE_ROWS >> 1))), h = '', i, t, v, mod, d = $('#tuneDesc');
        for (i = first; i < Math.min(TUNE_N, first + TUNE_ROWS); i++) {
            if (i === TUNE.length)
                h += '<div class="tr' + (i === tuneI ? ' on' : '') + '"><span class="tn">RESET ALL TO DEFAULT (ENTER)</span><span class="tv"></span></div>';
            else {
                t = TUNE[i];
                v = tuneGet(t[1]);
                mod = v !== TUNE_DEF[t[1]];
                h += '<div class="tr' + (i === tuneI ? ' on' : '') + (mod ? ' mod' : '') + '"><span class="tn">' + t[1] + '</span><span class="tv">' + (i === tuneI ? '\u25C0 ' : '') + tuneFmt(v) + (i === tuneI ? ' \u25B6' : '') + '</span></div>';
            }
        }
        $('#tuneList').innerHTML = h;
        if (tuneI === TUNE.length)
            d.textContent = 'ENTER SETS EVERY VALUE BACK TO THE ORIGINAL';
        else {
            t = TUNE[tuneI];
            d.textContent = t[0] + ': ' + t[3] + ' (DEFAULT ' + tuneFmt(TUNE_DEF[t[1]]) + ')';
        }
        $('#tuneNr').textContent = (tuneI + 1) + ' / ' + TUNE_N;
    }
    function tuneKey(e) {
        var k = e.key, t = TUNE[tuneI];
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End') {
            tuneI = k === 'Home' ? 0 : k === 'End' ? TUNE_N - 1 : (tuneI + (k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : k === 'PageDown' ? 10 : -10) + TUNE_N * 20) % TUNE_N;
            sfx(440, 0.03);
        } else if ((k === 'ArrowLeft' || k === 'ArrowRight') && t) {
            tuneChange(t, k === 'ArrowRight' ? 1 : -1, e.shiftKey);
            sfx(k === 'ArrowRight' ? 600 : 500, 0.03);
        } else if (k === 'Enter' || k === ' ') {
            if (t)
                tuneSet(t[1], TUNE_DEF[t[1]]);
            else
                TUNE.forEach(function (u) {
                    tuneSet(u[1], TUNE_DEF[u[1]]);
                });
            tuneSave();
            sfx(880, 0.06);
        } else if (k === 'Escape' || k === 'Backspace') {
            show('gfx');
            sfx(520, 0.08);
        } else
            return;
        e.preventDefault();
        if (view === 'tune')
            tunePaint();
    }
    quitBtns[0].onclick = function () {
        sfx(520, 0.08);
        show('menu');
    };
    sndLabels();
    $('#sPlay').onclick = $('#oAgain').onclick = startGame;
    $('#sBack').onclick = $('#oMenu').onclick = function () {
        show('menu');
    };
    function renderScores() {
        var o = $('#rows');
        o.innerHTML = '';
        scores.forEach(function (s, i) {
            var li = document.createElement('li');
            if (i === hl)
                li.className = 'hl';
            li.innerHTML = '<b>' + (i + 1) + '.</b><span>' + s[0] + '</span><em>' + pad(s[1]) + '</em>';
            o.appendChild(li);
        });
    }
    /* initials */
    function letters() {
        [].forEach.call(document.querySelectorAll('.ini'), function (b, i) {
            b.textContent = String.fromCharCode(65 + ini[i]);
            b.classList.toggle('cur', i === cur);
        });
    }
    [].forEach.call(document.querySelectorAll('.ini'), function (b, i) {
        b.onclick = function () {
            cur = i;
            ini[i] = (ini[i] + 1) % 26;
            letters();
            sfx(500, 0.05);
        };
    });
    function qual(s) {
        return s > 0 && (scores.length < 5 || s > scores[scores.length - 1][1]);
    }
    function commit() {
        var n = ini.map(function (i) {
                return String.fromCharCode(65 + i);
            }).join(''), sc0 = G.score;
        scores.push([n, sc0]);
        scores.sort(function (a, b) {
            return b[1] - a[1];
        });
        hl = scores.findIndex(function (s) {
            return s[0] === n && s[1] === sc0;
        });
        scores = scores.slice(0, 5);
        save();
        sfx(900, 0.2);
        if (G.won)
            showWin();
        else
            show('scores');
    }
    $('#ok').onclick = commit;
    function showOver() {
        if (view !== 'game')
            return;
        var q = qual(G.score);
        if (G.won && !q) {
            showWin();
            return;
        }
        show('over');
        $('#ovT').textContent = G.won ? 'YOU WIN!' : 'GAME OVER';
        $('#ovs').textContent = 'SCORE ' + pad(G.score) + '  GEMS ' + G.gems;
        $('#entry').hidden = !q;
        $('#ovBtns').hidden = q;
        if (q) {
            ini = [0, 0, 0];
            cur = 0;
            letters();
        } else
            $('#oAgain').focus({ preventScroll: true });
    }
    /* game */
    var AS={},ASRC={"gemG":"graphics/items/gem_green.webp","gemB":"graphics/items/gem_blue.webp","gemR":"graphics/items/gem_red_danger.webp","heart":"graphics/items/heart.webp","kit":"graphics/items/health_kit.webp","knife":"graphics/items/throwing_knife_pickup.webp","mach":"graphics/items/machete_pickup.webp","vine":"graphics/level_plants_vines/vine.webp","bridge":"graphics/level_terrain/bridge.webp","log":"graphics/level_terrain/platform_log.webp","moss":"graphics/level_terrain/platform_moss.webp","spikes":"graphics/level_terrain/spikes.webp","f1":"graphics/level_plants_vines/f1.webp","f2":"graphics/level_plants_vines/f2.webp","f3":"graphics/level_plants_vines/f3.webp","pm":"graphics/level_plants_vines/pm.webp","ps":"graphics/level_plants_vines/ps.webp","fl1":"graphics/level_plants_vines/fl1.webp","fl2":"graphics/level_plants_vines/fl2.webp","rk":"graphics/level_plants_vines/rk.webp","pb":"graphics/level_plants_vines/pb.webp","pt":"graphics/level_plants_vines/pt.webp","bush":"graphics/level_plants_vines/bush.webp","tA":"graphics/level_terrain/ground_tile_top_1.webp","tB":"graphics/level_terrain/ground_tile_top_2.webp","tC":"graphics/level_terrain/ground_tile_top_3.webp","tD":"graphics/level_terrain/ground_tile_top_4.webp","tR":"graphics/level_terrain/ground_tile_rock.webp","snake":"graphics/enemies/snake.webp","bat1":"graphics/enemies/bat_wing_up.webp","bat2":"graphics/enemies/bat_wing_down.webp","rap1":"graphics/enemies/raptor_1.webp","rap2":"graphics/enemies/raptor_2.webp","steg":"graphics/enemies/crocodile.webp","liz":"graphics/enemies/lizard_man.webp","trunkT":"graphics/level_plants_vines/trunkT.webp","wpillar":"graphics/level_plants_vines/water_pillar_holder.webp","vp1":"graphics/level_plants_vines/vp1.webp","vp2":"graphics/level_plants_vines/vp2.webp","pc0":"graphics/level_plants_vines/pc0.webp","pc1":"graphics/level_plants_vines/pc1.webp","pc2":"graphics/level_plants_vines/pc2.webp","trk":"graphics/level_plants_vines/trk.webp","swing":"graphics/hero_swing/swing_on_vine.png","beast":"graphics/enemies/armored_beast.webp","dfly":"graphics/enemies/dragonfly.webp","spid":"graphics/enemies/spider.webp","crouch":"graphics/hero_crouch/crouch_2_hold.png","cw00":"graphics/hero_crouch/crouch_walk_01.png","cw01":"graphics/hero_crouch/crouch_walk_02.png","cw02":"graphics/hero_crouch/crouch_walk_03.png","cw03":"graphics/hero_crouch/crouch_walk_04.png","cw04":"graphics/hero_crouch/crouch_walk_05.png","cw05":"graphics/hero_crouch/crouch_walk_06.png","cw06":"graphics/hero_crouch/crouch_walk_07.png","cw07":"graphics/hero_crouch/crouch_walk_08.png","cw08":"graphics/hero_crouch/crouch_walk_09.png","cw09":"graphics/hero_crouch/crouch_walk_10.png","cw10":"graphics/hero_crouch/crouch_walk_11.png","cw11":"graphics/hero_crouch/crouch_walk_12.png","cw12":"graphics/hero_crouch/crouch_walk_13.png","cw13":"graphics/hero_crouch/crouch_walk_14.png","cw14":"graphics/hero_crouch/crouch_walk_15.png","cw15":"graphics/hero_crouch/crouch_walk_16.png","cw16":"graphics/hero_crouch/crouch_walk_17.png","cw17":"graphics/hero_crouch/crouch_walk_18.png","cw18":"graphics/hero_crouch/crouch_walk_19.png","cw19":"graphics/hero_crouch/crouch_walk_20.png","cw20":"graphics/hero_crouch/crouch_walk_21.png","cw21":"graphics/hero_crouch/crouch_walk_22.png","cw22":"graphics/hero_crouch/crouch_walk_23.png","cw23":"graphics/hero_crouch/crouch_walk_24.png","cw24":"graphics/hero_crouch/crouch_walk_25.png","cw25":"graphics/hero_crouch/crouch_walk_26.png","cw26":"graphics/hero_crouch/crouch_walk_27.png","cw27":"graphics/hero_crouch/crouch_walk_28.png","cw28":"graphics/hero_crouch/crouch_walk_29.png","cw29":"graphics/hero_crouch/crouch_walk_30.png","cw30":"graphics/hero_crouch/crouch_walk_31.png","cw31":"graphics/hero_crouch/crouch_walk_32.png","cw32":"graphics/hero_crouch/crouch_walk_33.png","cw33":"graphics/hero_crouch/crouch_walk_34.png","cw34":"graphics/hero_crouch/crouch_walk_35.png","cw35":"graphics/hero_crouch/crouch_walk_36.png","cw36":"graphics/hero_crouch/crouch_walk_37.png","cw37":"graphics/hero_crouch/crouch_walk_38.png","cw38":"graphics/hero_crouch/crouch_walk_39.png","cw39":"graphics/hero_crouch/crouch_walk_40.png","cw40":"graphics/hero_crouch/crouch_walk_41.png","cw41":"graphics/hero_crouch/crouch_walk_42.png","cw42":"graphics/hero_crouch/crouch_walk_43.png","cw43":"graphics/hero_crouch/crouch_walk_44.png","cw44":"graphics/hero_crouch/crouch_walk_45.png","down":"graphics/hero_crouch/crouch_1_going_down.png","bw2":"graphics/boss/boss_walk_2.png","bsh":"graphics/boss/boss_shoot.png","bfl":"graphics/boss/boss_muzzle_flash.png","cs1":"graphics/crocodile/croc_swim_1.webp","cs2":"graphics/crocodile/croc_swim_2.webp","ct1":"graphics/crocodile/croc_turn_1.webp","ct2":"graphics/crocodile/croc_turn_2.webp","ct3":"graphics/crocodile/croc_turn_3.webp","ct4":"graphics/crocodile/croc_turn_4.webp","ct5":"graphics/crocodile/croc_turn_5.webp","ca1":"graphics/crocodile/croc_attack_1.webp","ca2":"graphics/crocodile/croc_attack_2.webp","ca3":"graphics/crocodile/croc_attack_3.webp","ca4":"graphics/crocodile/croc_attack_4.webp","cc1":"graphics/crocodile/croc_catch_1.webp","cc2":"graphics/crocodile/croc_catch_2.webp","cc3":"graphics/crocodile/croc_catch_3.webp","cc4":"graphics/crocodile/croc_catch_4.webp","cc5":"graphics/crocodile/croc_catch_5.webp","cc6":"graphics/crocodile/croc_catch_6.webp","face0":"graphics/status_bar/face_normal.webp","face1":"graphics/status_bar/face_hurt.webp","face2":"graphics/status_bar/face_low.webp"},BGS=[$('#bg'),$('#bg3'),$('#bg2'),$('#bg4'),$('#bg5')],SKYS=[$('#sky1'),$('#sky2')],L,LI=0,P,K={},EN=[],IT=[],PR=[],PA=[],DEC=[],SW=[],HL=[],MP=[],cam=0,camY=90,T=0,sd=11,hudS='';
    Object.keys(ASRC).forEach(function (n) {
        var i = new Image();
        i.src = ASRC[n];
        AS[n] = i;
    });
    var HM={"w": 35.83, "h": 47.92, "ax": 19.5, "ay": 46.39, "idle": 8, "air": 0},HF=["graphics/hero_run/run_01.png","graphics/hero_run/run_02.png","graphics/hero_run/run_03.png","graphics/hero_run/run_04.png","graphics/hero_run/run_05.png","graphics/hero_run/run_06.png","graphics/hero_run/run_07.png","graphics/hero_run/run_08.png","graphics/hero_run/run_09.png","graphics/hero_run/run_10.png","graphics/hero_run/run_11.png","graphics/hero_run/run_12.png","graphics/hero_run/run_13.png","graphics/hero_run/run_14.png","graphics/hero_run/run_15.png","graphics/hero_run/run_16.png","graphics/hero_run/run_17.png","graphics/hero_run/run_18.png","graphics/hero_run/run_19.png","graphics/hero_run/run_20.png","graphics/hero_run/run_21.png","graphics/hero_run/run_22.png","graphics/hero_run/run_23.png","graphics/hero_run/run_24.png","graphics/hero_run/run_25.png","graphics/hero_run/run_26.png","graphics/hero_run/run_27.png","graphics/hero_run/run_28.png","graphics/hero_run/run_29.png","graphics/hero_run/run_30.png","graphics/hero_run/run_31.png"].map(function(u){var i=new Image();i.src=u;return i});
    /* ---- animation sets: hero swim / vine hang, enemy move + attack (graphics/hero_swim, hero_hang, enemy_anims) ---- */
    function imgSrc(p) {
        return window.JC_PACK && window.JC_PACK[p] || p;
    }
    /* JC_PACK only exists in the single-file build */
    function pingPong(n) {
        /* 0,1,2 ... n-1, n-2 ... 1 : plays an animation forward and then backward */
        var a = [], i;
        for (i = 0; i < n; i++)
            a.push(i);
        for (i = n - 2; i > 0; i--)
            a.push(i);
        return a;
    }
    /* A picture file that does not exist (you set a frame count higher than the number of files) is replaced by an empty picture, so the game never stops. */
    var BLANK_PIC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    function loadPic(src) {
        var im = new Image();
        im.onerror = function () {
            im.onerror = null;
            im.src = BLANK_PIC;
        };
        im.src = src;
        return im;
    }
    /* seqImgs: pictures path + prefix + 01, 02, 03 ... n  (files are numbered with two digits from 01) */
    function seqImgs(path, n, pre, ext) {
        var a = [], i;
        for (i = 1; i <= n; i++)
            a.push(loadPic(imgSrc(path + (pre || '') + (i < 10 ? '0' : '') + i + (ext || (path.indexOf('graphics/hero_') === 0 ? '.png' : '.webp')))));
        return a;
    }
    function namedImgs(dir, nm, kind, n) {
        var a = [], i;
        for (i = 1; i <= n; i++)
            a.push(loadPic(imgSrc('graphics/enemy_anims/' + dir + '/' + dir + '_' + kind + '_' + i + '.webp')));
        return a;
    }
    /* tb: one number per picture from a table; a picture without its own number (you added pictures) uses the nearest number of the table */
    function tb(a, i) {
        return a[Math.max(0, Math.min(a.length - 1, i | 0))];
    }
    function okSet(a) {
        var i;
        if (!a || !a.length)
            return false;
        for (i = 0; i < a.length; i++)
            if (!a[i].naturalWidth)
                return false;
        return true;
    }
    var SWIMF = seqImgs('graphics/hero_swim/', FRAMES_HERO_SWIM, 'swim_'), SWIMD = { w: 52.5, h: 27.71 }, HANGF = seqImgs('graphics/hero_hang/', FRAMES_HERO_HANG, 'hang_'), HANGD = {
            w: 47.84,
            h: 57.41,
            grip: [
                [33.03, 7.45], [31.65, 7.45], [30.68, 7.54], [29.35, 7.54],
                [28.61, 7.54], [27.51, 7.73], [26.73, 7.64], [25.62, 7.64],
                [24.98, 7.64], [24.06, 7.73], [25.09, 7.82], [25.07, 6.16],
                [23.92, 4.69], [21.57, 3.59], [19.92, 3.31], [18.72, 2.02],
                [18.17, 2.21], [17.43, 2.30], [16.97, 2.30], [16.05, 3.13],
                [15.69, 3.13]
            ]
        }, ENDIR = ['snake', 'bat', 'crocodile', 'raptor', 'lizard_man', 'spider', 'dragonfly', 'armored_beast', 'skeleton'], ENEMY_MOVE_FRAMES = [FRAMES_SNAKE_MOVE, FRAMES_BAT_FLY, FRAMES_CROCODILE_SWIM, FRAMES_RAPTOR_RUN, FRAMES_LIZARDMAN_WALK, FRAMES_SPIDER_WALK, FRAMES_DRAGONFLY_FLY, FRAMES_BEAST_WALK, FRAMES_SKELETON_WALK],
        ENEMY_ATTACK_FRAMES = [FRAMES_SNAKE_ATTACK, FRAMES_BAT_ATTACK, FRAMES_CROCODILE_ATTACK, FRAMES_RAPTOR_ATTACK, FRAMES_LIZARDMAN_ATTACK, FRAMES_SPIDER_ATTACK, FRAMES_DRAGONFLY_ATTACK, FRAMES_BEAST_ATTACK, FRAMES_SKELETON_ATTACK],
        ENMV = ENDIR.map(function (d, i) {
            return d === 'skeleton' ? seqImgs('graphics/enemy_anims/skeleton/', ENEMY_MOVE_FRAMES[i], 'skeleton_walk_') : namedImgs(d, d, 'move', ENEMY_MOVE_FRAMES[i]);
        }), ENAT = ENDIR.map(function (d, i) {
            return d === 'skeleton' ? seqImgs('graphics/enemy_anims/skeleton/', ENEMY_ATTACK_FRAMES[i], 'skeleton_attack_') : namedImgs(d, d, 'attack', ENEMY_ATTACK_FRAMES[i]);
        }), ENMT = [12, 6, 14, 9, 14, 7, 4, 16, 3.3], ATK_RX = [46, 50, 56, 54, 56, 44, 50, 60, 44];
    /* attack animation: trigger range, length and cooldown. SK_HIT=1: the skeleton's long sword really hurts (last 2 attack pictures), SK_REACH = how far it reaches from his centre (units); SK_HIT=0 = sword is only a picture */
    /* ---- ARCHER (enemy kind 9): stands on the bridge before the skeleton bridge, plays her idle animation ARC_IDLE_LOOPS (3) times, then shoots ONE arrow (attack animation), then idle x3 again ... dies after ARC_HP hits.
   Pictures: graphics/enemy_anims/archer (archer_idle_01..12.webp = idle loop, archer_attack_01..25.webp, cut out of Idle_Guard_Bridge.webp / enemy10attack.zip, she faces LEFT). */
    var ARCF = seqImgs('graphics/enemy_anims/archer/', FRAMES_ARCHER10_ATTACK, 'archer_attack_'), ARCI = seqImgs('graphics/enemy_anims/archer/', FRAMES_ARCHER10_IDLE, 'archer_idle_'), AR = [];
    /* ARC_TPF = game ticks per attack picture (3.6 -> 16 pictures/s; the draw-and-shoot takes 1.4 s). ARC_REL = picture where the arrow leaves (0 = first).
   ARC_RANGE = she starts shooting when you are closer than this (units). ARC_SPEED = arrow speed. ARC_AIM = how steeply she may aim up/down. */
    function archerUpd(e, dt) {
        if (!ARC_ON)
            return;
        var N = ARCF.length, NI = ARCI.length, LEN = NI * ARC_IDLE_TPF, dx = P.x + P.w / 2 - (e.x + e.w / 2);
        if (e.ap < 0) {
            e.d = dx < 0 ? -1 : 1;
            var near = G.run && !P.caught && Math.abs(dx) < ARC_RANGE;
            /* idle animation runs all the time; every finished idle loop while you are in range counts, after ARC_IDLE_LOOPS loops she shoots once */
            e.ia = (e.ia || 0) + dt;
            if (!near)
                e.il = 0;
            if (e.ia >= LEN) {
                e.ia -= LEN * Math.floor(e.ia / LEN);
                if (near)
                    e.il = (e.il || 0) + 1;
                if (near && e.il >= ARC_IDLE_LOOPS && okSet(ARCF)) {
                    e.ap = 0;
                    e.sh = 0;
                    e.il = 0;
                    e.ia = 0;
                }
            }
        } else if (e.ap < N) {
            e.ap += dt / ARC_TPF;
            if (!e.sh && e.ap >= Math.min(ARC_REL, ARCF.length - 1)) {
                e.sh = 1;
                archerShoot(e);
            }
            if (e.ap >= N) {
                e.ap = N;
                e.rc = ARC_RECOV;
            }
        } else {
            e.rc -= dt;
            if (e.rc <= 0) {
                e.ap = -1;
                e.ia = 0;
                e.il = 0;
            }
        }
    }
    function archerShoot(e) {
        var d = e.d, sx = e.x + e.w / 2 + d * ARC_SX, sy = e.y + e.h - ARC_SY, tx = P.x + P.w / 2, ty = P.y + P.h * 0.4, dx = tx - sx, dy = ty - sy, sl = 0;
        if (dx * d > 0)
            sl = Math.max(-ARC_AIM, Math.min(ARC_AIM, dy / Math.max(30, Math.abs(dx))));
        var vx = d * ARC_SPEED / Math.sqrt(1 + sl * sl);
        AR.push({ x: sx, y: sy, vx: vx, vy: sl * Math.abs(vx), l: 260 });
        if (!sampSnd(ARRB, ARR_VOL)) {
            sfx(520, 0.12, 'triangle', 180);
            sfx(160, 0.08, 'sawtooth', 90);
        }
    }
    function arrowUpd(dt, mb) {
        AR.forEach(function (q) {
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            q.l -= dt;
            var tx = q.k === 1 ? q.x : q.x + Math.sign(q.vx) * (q.L || ARC_LEN) * 0.5, r = { x: tx - 1.5, y: q.y - 1.5, w: 3, h: 3 };
            if (sol(r)) {
                q.l = 0;
                return;
            }
            if (q.k !== 1 && mb && ov(mb, { x: q.x - (q.L || ARC_LEN) / 2, y: q.y - 2, w: q.L || ARC_LEN, h: 4 })) {
                q.l = 0;
                burst(q.x, q.y, '#c9a45e');
                sfx(420, 0.08, 'square', 200);
                return;
            }
            if (q.l > 0 && ov(r, { x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 2 })) {
                q.l = 0;
                hurt(1);
            }
        });
        AR = AR.filter(function (q) {
            return q.l > 0;
        });
    }
    function arrowDraw() {
        AR.forEach(function (q) {
            if (q.k === 2 && ARC2_ARW.naturalWidth) {
                var a2 = Math.atan2(q.vy, q.vx), aw = q.L, ah = aw * ARC2_ARW.naturalHeight / ARC2_ARW.naturalWidth * ARC2_THICK;
                x.save();
                x.translate(q.x, q.y);
                x.rotate(a2);
                if (q.vx < 0)
                    x.scale(1, -1);
                x.drawImage(ARC2_ARW, -aw / 2, -ah / 2, aw, ah);
                x.restore();
                return;
            }
            if (q.k === 1) {
                var ba = Math.atan2(q.vy, q.vx);
                x.save();
                x.translate(q.x, q.y);
                x.rotate(ba);
                x.fillStyle = 'rgba(255,190,80,.35)';
                x.fillRect(-9, -0.8, 9, 1.6);
                x.fillStyle = 'rgba(255,230,150,.7)';
                x.fillRect(-5, -0.6, 5, 1.2);
                x.fillStyle = '#fff6d0';
                x.beginPath();
                x.ellipse(0, 0, 2.6, 1.1, 0, 0, 6.3);
                x.fill();
                x.restore();
                return;
            }
            var a = Math.atan2(q.vy, q.vx), L = ARC_LEN;
            x.save();
            x.translate(q.x, q.y);
            x.rotate(a);
            x.strokeStyle = '#5a4220';
            x.lineWidth = 1.3;
            x.beginPath();
            x.moveTo(-L / 2, 0);
            x.lineTo(L / 2 - 2, 0);
            x.stroke();
            x.strokeStyle = '#d7b46a';
            x.lineWidth = 0.8;
            x.beginPath();
            x.moveTo(-L / 2, 0);
            x.lineTo(L / 2 - 2, 0);
            x.stroke();
            x.fillStyle = '#16130f';
            x.beginPath();
            x.moveTo(-L / 2 - 0.6, 0);
            x.lineTo(-L / 2 + 1.8, -2.1);
            x.lineTo(-L / 2 + 5.6, -2.1);
            x.lineTo(-L / 2 + 4.2, 0);
            x.lineTo(-L / 2 + 5.6, 2.1);
            x.lineTo(-L / 2 + 1.8, 2.1);
            x.closePath();
            x.fill();
            x.fillStyle = '#b9bec6';
            x.strokeStyle = '#33363b';
            x.lineWidth = 0.35;
            x.beginPath();
            x.moveTo(L / 2 + 0.6, 0);
            x.lineTo(L / 2 - 3.2, -1.7);
            x.lineTo(L / 2 - 2.2, 0);
            x.lineTo(L / 2 - 3.2, 1.7);
            x.closePath();
            x.fill();
            x.stroke();
            x.restore();
        });
    }
    function archerDraw(e) {
        var N = ARCF.length, NI = ARCI.length, feet = e.y + e.h, cx = e.x + e.w / 2, idl = ARCI[Math.min(NI - 1, Math.floor((e.ia || 0) / ARC_IDLE_TPF) % NI)], idl0 = ARCI[0], im = idl, im2 = null, w = 0, base = 1;
        if (e.ap >= 0 && okSet(ARCF)) {
            if (e.ap >= N) {
                im = ARCF[N - 1];
                im2 = idl0;
                w = 1 - Math.max(0, e.rc) / ARC_RECOV;
                base = 1 - w;
            } else {
                var j = Math.floor(e.ap);
                im = ARCF[j];
                w = (e.ap - j) * 0.6;
                if (j < N - 1 && w > 0.02)
                    im2 = ARCF[j + 1];
                if (ARC_FADE > 0 && e.ap < ARC_FADE) {
                    /* idle pose (bottom) fades into the attack pose (top) */
                    im2 = im;
                    im = idl0;
                    w = e.ap / ARC_FADE;
                }
            }
        }
        if (!im || !im.naturalWidth)
            return;
        var iw = im.naturalWidth * ARC_K, ih = im.naturalHeight * ARC_K, hit = e.hc > 0 && (e.hc | 0) % 4 < 2 ? 0.5 : 1;
        x.save();
        x.translate(cx, feet);
        if (e.d > 0)
            x.scale(-1, 1);
        x.globalAlpha = base * hit;
        x.drawImage(im, -ARC_AX * ARC_K, -ARC_AY * ARC_K, iw, ih);
        if (im2 && im2.naturalWidth) {
            x.globalAlpha = w * hit;
            x.drawImage(im2, -ARC_AX * ARC_K, -ARC_AY * ARC_K, im2.naturalWidth * ARC_K, im2.naturalHeight * ARC_K);
        }
        x.restore();
    }
    /* ---- ARCHER 30 (enemy kind 13, "enemy30 archery"): a second archer girl. She only stands (idle animation, 17 pictures) until you come closer than ARC2_RANGE, then draws and shoots one arrow every ARC2_PERIOD ticks.
   Pictures: graphics/enemy_anims/archer30 (enemy30_idle_01..02, enemy30_attack_01..07 = draw/aim/release, enemy30_arrow.webp = the arrow cut out of the picture; she faces LEFT). ---- */
    var ARC2_D = [6].concat(Array(18).fill(1.5), Array(6).fill(2), Array(10).fill(2.5), [3, 4, 2.5, 2.5]),
        /* ticks per idle picture (17 idle pictures, played forward and then backward = breathing) */
        ARC2_I = seqImgs('graphics/enemy_anims/archer30/', FRAMES_ARCHER30_IDLE, 'enemy30_idle_'), ARC2_A = seqImgs('graphics/enemy_anims/archer30/', FRAMES_ARCHER30_ATTACK, 'enemy30_attack_'), ARC2_ARW = new Image(), ARC2_CUM = [0], ARC2_PP = pingPong(FRAMES_ARCHER30_IDLE);
    ARC2_ARW.src = imgSrc('graphics/enemy_anims/archer30/enemy30_arrow.webp');
    ARC2_A.forEach(function (im, i) {
        ARC2_CUM.push(ARC2_CUM[ARC2_CUM.length - 1] + tb(ARC2_D, i));
    });
    function arc2Idle(e) {
        var f = (T + e.t * 7) / ARC2_IT, j = Math.floor(f), w = f - j;
        w = w * w * (3 - 2 * w);
        return { a: ARC2_PP[(j % ARC2_PP.length + ARC2_PP.length) % ARC2_PP.length], b: ARC2_PP[((j + 1) % ARC2_PP.length + ARC2_PP.length) % ARC2_PP.length], w: w };
    }
    function archer2Upd(e, dt) {
        if (!ARC2_ON)
            return;
        var N = ARC2_CUM[ARC2_CUM.length - 1], dx = P.x + P.w / 2 - (e.x + e.w / 2);
        if (e.ac2 > 0)
            e.ac2 -= dt;
        if (e.ap < 0) {
            e.d = dx < 0 ? -1 : 1;
            if (e.ac2 <= 0 && G.run && !P.caught && Math.abs(dx) < ARC2_RANGE && okSet(ARC2_I) && okSet(ARC2_A)) {
                var ii = arc2Idle(e);
                e.aj = ii.w > 0.5 ? ii.b : ii.a;
                e.ap = 0;
                e.sh = 0;
                e.ac2 = ARC2_PERIOD;
            }
        } else if (e.ap < N) {
            e.ap += dt;
            if (!e.sh && e.ap >= ARC2_CUM[Math.min(ARC2_REL, ARC2_A.length - 1)] + 1) {
                e.sh = 1;
                archer2Shoot(e);
            }
            if (e.ap >= N) {
                e.ap = N;
                e.rc = ARC2_REC;
            }
        } else {
            e.rc -= dt;
            if (e.rc <= 0)
                e.ap = -1;
        }
    }
    function archer2Shoot(e) {
        var d = e.d, sx = e.x + e.w / 2 + d * ARC2_SX, sy = e.y + e.h - ARC2_SY, tx = P.x + P.w / 2, ty = P.y + P.h * 0.4, dx = tx - sx, dy = ty - sy, sl = 0;
        if (dx * d > 0)
            sl = Math.max(-ARC2_AIM, Math.min(ARC2_AIM, dy / Math.max(30, Math.abs(dx))));
        var vx = d * ARC2_SPEED / Math.sqrt(1 + sl * sl);
        AR.push({ x: sx, y: sy, vx: vx, vy: sl * Math.abs(vx), l: 260, k: 2, L: ARC2_LEN });
        if (!sampSnd(ARRB, ARR_VOL)) {
            sfx(520, 0.12, 'triangle', 180);
            sfx(160, 0.08, 'sawtooth', 90);
        }
    }
    function arc2Put(im, al) {
        var a = ARC2_A.indexOf(im) >= 0;
        x.globalAlpha = al;
        x.drawImage(im, -(a ? ARC2_BX : ARC2_AX) * ARC2_K, -(a ? ARC2_BY : ARC2_AY) * ARC2_K, im.naturalWidth * ARC2_K, im.naturalHeight * ARC2_K);
    }
    function archer2Draw(e) {
        var N = ARC2_CUM[ARC2_CUM.length - 1], feet = e.y + e.h, cx = e.x + e.w / 2, im, im2 = null, w = 0, hit = e.hc > 0 && (e.hc | 0) % 4 < 2 ? 0.5 : 1;
        if (!okSet(ARC2_I) || !okSet(ARC2_A))
            return;
        if (e.ap >= 0) {
            if (e.ap >= N) {
                im = ARC2_A[ARC2_A.length - 1];
                im2 = ARC2_I[0];
                w = 1 - Math.max(0, e.rc) / ARC2_REC;
            } else {
                var j = 0;
                while (j < ARC2_A.length - 1 && e.ap >= ARC2_CUM[j + 1])
                    j++;
                w = (e.ap - ARC2_CUM[j]) / tb(ARC2_D, j);
                w = w * w * (3 - 2 * w);
                im = j === 0 ? ARC2_I[e.aj || 0] : ARC2_A[j - 1];
                im2 = ARC2_A[j];
            }
        } else {
            var ii = arc2Idle(e);
            im = ARC2_I[ii.a];
            im2 = ARC2_I[ii.b];
            w = ii.w;
        }
        if (!im || !im.naturalWidth)
            return;
        x.save();
        x.translate(cx, feet);
        if (e.d > 0)
            x.scale(-1, 1);
        arc2Put(im, hit);
        if (im2 && im2.naturalWidth && w > 0.01)
            arc2Put(im2, w * hit);
        x.restore();
    }
    /* skeleton walk: 36 pictures (graphics/enemy_anims/skeleton/skeleton_walk_01..36.webp, 320 px = drawn at 1/6.4, cut out of skeletonloop.zip); the attack pictures skeleton_attack_1..4 are the old ones.
   Ticks per walk picture = the 9th number of ENMT (3.3 -> one full left+right step cycle takes 119 ticks, matches his walking speed). */
    HANGD.w *= HANG_K;
    HANGD.h *= HANG_K;
    HANGD.grip = HANGD.grip.map(function (g) {
        return [
            g[0] * HANG_K,
            g[1] * HANG_K
        ];
    });
    var JUMP_ON=1,JUMPF=seqImgs('graphics/hero_jump/',FRAMES_HERO_JUMP,'jump_'),JD={k:0.11628,c:25.15,ax:[250.2, 250.3, 250.3, 250.2, 250.0, 250.0, 250.4, 251.0, 252.0, 253.1, 254.5, 255.7, 256.7, 257.6, 258.5, 259.4, 260.4, 261.3, 262.1, 263.0, 263.7, 264.3, 265.0, 265.8, 266.6, 267.3, 267.9, 268.6, 269.1, 269.6, 269.8, 269.9, 269.8, 269.9, 270.0, 270.1, 269.7, 268.9, 267.9, 267.2, 266.9, 266.9, 267.0, 267.3, 267.8],ay:[252.3, 250.8, 248.8, 246.3, 243.2, 239.1, 234.3, 229.1, 223.0, 216.0, 208.3, 202.3, 198.2, 195.7, 193.7, 192.0, 190.5, 189.2, 188.1, 187.3, 186.6, 186.3, 186.1, 186.2, 186.5, 187.0, 187.7, 188.5, 189.5, 190.7, 192.2, 193.9, 195.9, 198.5, 202.1, 206.8, 212.8, 220.0, 228.0, 236.6, 244.7, 252.3, 257.3, 259.8, 259.7],hx:[341.4, 344.1, 345.6, 345.1, 342.3, 339.3, 337.0, 335.7, 334.8, 333.7, 332.2, 331.3, 331.6, 334.1, 338.4, 343.4, 348.1, 352.1, 355.3, 357.8, 359.6, 361.0, 362.2, 363.3, 364.1, 364.8, 365.0, 365.0, 364.4, 363.8, 362.6, 360.9, 358.0, 354.4, 349.7, 344.7, 339.0, 333.3, 328.1, 323.6, 320.8, 320.9, 325.7, 333.9, 342.7],hy:[156.3, 152.8, 147.6, 141.1, 134.8, 128.6, 122.8, 117.1, 111.4, 105.5, 99.8, 95.6, 92.7, 90.9, 89.2, 87.6, 86.3, 85.4, 84.8, 84.5, 84.4, 84.6, 85.0, 85.8, 86.8, 88.0, 89.1, 90.3, 91.6, 93.3, 94.9, 96.7, 98.8, 101.4, 104.9, 108.6, 113.2, 118.4, 124.9, 132.1, 139.8, 146.6, 151.6, 153.5, 153.2]};
    /* jump animation: 45 frames (graphics/hero_jump, 500x500 px, faces right). Frame is picked from the real jump physics (vy), so it plays at full frame rate and follows short hops, long falls and ledge drops.
   JD.k = game units per source pixel, JD.c = body-centre height above the feet, ax/ay = body-centre pixel per frame, hx/hy = front-fist pixel per frame (whip/machete start). */
    function gGap() {
        var fy = P.y + P.h, best = 60, a = P.x + 1, b = P.x + P.w - 1;
        L.s.forEach(function (s) {
            if (b <= s[0] || a >= s[0] + s[2])
                return;
            var g = s[1] - fy;
            if (g >= -1 && g < best)
                best = g;
        });
        MP.forEach(function (m) {
            if (b > m.x && a < m.x + m.w) {
                var g = m.y - fy;
                if (g >= -1 && g < best)
                    best = g;
            }
        });
        return Math.max(0, best);
    }
    function jumpIdx() {
        var vy = P.vy, jn = JUMPF.length - 1, ja = Math.min(JAPEX, jn - 2), t = vy < 0 ? ja * (1 + Math.max(-JV0, vy) / JV0) : ja + (jn - 0.01 - ja) * Math.min(1, vy / JV0), g;
        if (vy >= 0 && (g = gGap()) < JLAND)
            t = Math.max(t, ja + (jn - ja) * (1 - g / JLAND) * 0.9 + (g < 4 ? (4 - g) / 4 * 2.2 : 0));
        /* reach for the ground just before landing */
        t = Math.max(0, Math.min(jn, t));
        var dts = Math.max(0.2, Math.min(3, T - (P.jt || T)));
        P.jt = T;
        if (P.jf == null || P.jf < 0)
            P.jf = t;
        else
            P.jf += Math.max(-JRATE * dts, Math.min(JRATE * dts, t - P.jf));
        return P.jf;
    }
    function rn() {
        sd = sd * 16807 % 2147483647;
        return sd / 2147483647;
    }
    function rc(c, px, py, w, h, col) {
        c.fillStyle = col;
        c.fillRect(px | 0, py | 0, (w | 0) + 0.35, (h | 0) + 0.35);
    }
    function sp(n, px, py, w, h) {
        var i = AS[n];
        if (!i || !i.naturalWidth)
            return;
        x.drawImage(i, px, py, w || i.naturalWidth / 3.2, h || i.naturalHeight / 3.2);
    }
    function limb(x0, y0, x1, y1, w, c, hc) {
        var j, u, lx, ly;
        for (j = 0; j <= 6; j++) {
            u = j / 6;
            rc(x, x0 + (x1 - x0) * u - 1, y0 + (y1 - y0) * u - 1, w + 2, w + 2, '#1a0e08');
        }
        for (j = 0; j <= 6; j++) {
            u = j / 6;
            lx = x0 + (x1 - x0) * u;
            ly = y0 + (y1 - y0) * u;
            rc(x, lx, ly, w, w, c);
            rc(x, lx, ly, 1, w, hc);
        }
    }
    function ov(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    /* level data. solids [x,y,w,h,type] g=ground r=rock block m/l/b=one-way moss/log/bridge. water [x,w,surfaceY,swim]. vines [x,top,bottom,sideToStepOff]. enemies [0 snake|1 bat,x,min,max]. items [name,x,y] */
    var LV=[{bg:[0, 1, 3, 4],sky:0,W:18120,n:'JUNGLE RIVER',g:18025,c:[20, 683, 1088, 1104, 1378, 1540, 1900, 1940, 2342, 2775, 2791, 3215, 3567, 3583, 3879, 4278, 4638, 5242, 5300, 5713, 6126, 6539, 6952, 7365, 7620, 8290, 8960, 9630, 10448, 11294, 11702, 12009, 12270, 13520, 14470, 14670, 15183, 15526, 15542, 16045, 16506, 16522, 16794, 17291, 17549],s:[[0, 161, 67, 79, 'g'], [67, 172, 73, 68, 'g'], [140, 136, 76, 104, 'g'], [216, 156, 43, 84, 'g'], [259, 156, 83, 84, 'g'], [342, 154, 51, 86, 'g'], [393, 129, 72, 111, 'g'], [465, 104, 36, 136, 'g'], [501, 104, 55, 136, 'g'], [556, 134, 50, 106, 'g'], [606, 134, 44, 106, 'g'], [650, 134, 23, 106, 'g'], [673, 172, 83, 68, 'g'], [756, 172, 14, 68, 'g'], [1078, 172, 16, 68, 'g'], [1094, 166, 93, 74, 'g'], [1187, 169, 43, 71, 'g'], [1230, 155, 19, 85, 'g'], [1249, 154, 101, 8, 'b'], [1350, 154, 18, 86, 'g'], [1368, 154, 60, 86, 'g'], [1428, 154, 76, 86, 'g'], [1504, 131, 26, 109, 'g'], [1530, 143, 57, 97, 'g'], [1890, 181, 40, 59, 'g'], [1930, 138, 74, 102, 'g'],  [2046, 156, 39, 84, 'g'], [2085, 162, 70, 78, 'g'], [2155, 172, 20, 68, 'g'], [2175, 114, 76, 126, 'g'], [2251, 114, 81, 126, 'g'], [2332, 164, 58, 76, 'g'], [2390, 164, 14, 76, 'g'], [2765, 164, 16, 76, 'g'], [2781, 156, 43, 84, 'g'], [2824, 136, 76, 104, 'g'], [2900, 172, 70, 68, 'g'], [2970, 164, 58, 76, 'g'], [3028, 164, 81, 76, 'g'], [3109, 114, 76, 126, 'g'], [3185, 172, 20, 68, 'g'], [3205, 162, 70, 78, 'g'], [3275, 162, 14, 78, 'g'], [3557, 162, 16, 78, 'g'], [3573, 172, 83, 68, 'g'], [3656, 172, 67, 68, 'g'], [3723, 136, 49, 104, 'g'], [3772, 172, 87, 68, 'g'], [3859, 172, 10, 68, 'g'], [3869, 162, 59, 78, 'g'], [3928, 162, 66, 78, 'g'], [3994, 166, 93, 74, 'g'], [4087, 169, 43, 71, 'g'], [4130, 155, 19, 85, 'g'], [4149, 155, 101, 8, 'b'], [4250, 154, 18, 86, 'g'], [4268, 154, 60, 86, 'g'], [4628, 148, 59, 92, 'g'], [4687, 186, 23, 54, 'g'], [4710, 186, 48, 54, 'g'], [4758, 156, 32, 84, 'g'], [4790, 181, 40, 59, 'g'], [4830, 138, 74, 102, 'g'], [4946, 156, 39, 84, 'g'], [4985, 162, 70, 78, 'g'], [5055, 172, 20, 68, 'g'], [5075, 114, 76, 126, 'g'], [5151, 114, 81, 126, 'g'], [5232, 164, 58, 76, 'g'], [5290, 176, 253, 64, 'g'], [5703, 176, 253, 64, 'g'], [6116, 176, 253, 64, 'g'], [6529, 176, 253, 64, 'g'], [6942, 176, 253, 64, 'g'], [7355, 176, 255, 64, 'g'], [7610, 170, 310, 70, 'g'], [8280, 170, 310, 70, 'g'], [8950, 170, 310, 70, 'g'], [9620, 170, 310, 70, 'g'], [9930, 173, 30, 67, 'g'], [9960, 147, 21, 93, 'g'], [9981, 173, 23, 67, 'g'], [10004, 173, 107, 8, 'b'], [10111, 171, 13, 69, 'g'], [10124, 169, 57, 71, 'g'], [10181, 169, 102, 8, 'b'], [10283, 159, 43, 81, 'g'], [10326, 178, 41, 62, 'g'], [10367, 158, 33, 82, 'g'], [10400, 179, 16, 61, 'g'], [10416, 172, 22, 68, 'g'], [10438, 160, 50, 80, 'g'], [10488, 188, 22, 52, 'g'], [10510, 188, 22, 52, 'g'], [10532, 160, 50, 80, 'g'], [10582, 172, 22, 68, 'g'], [10604, 179, 16, 61, 'g'], [10620, 158, 33, 82, 'g'], [10653, 178, 40, 62, 'g'], [10693, 159, 44, 81, 'g'], [10737, 159, 102, 8, 'b'], [10839, 169, 57, 71, 'g'], [10896, 135, 13, 105, 'g'], [10909, 135, 106, 8, 'b'], [11015, 135, 24, 19, 'g'], [11015, 154, 24, 86, 'g'], [11039, 147, 21, 93, 'g'], [11060, 173, 30, 67, 'g'], [11090, 173, 30, 67, 'g'], [11120, 147, 21, 93, 'g'], [11141, 173, 23, 67, 'g'], [11164, 173, 107, 8, 'b'], [11271, 171, 13, 69, 'g'], [11284, 169, 57, 71, 'g'], [11341, 169, 102, 8, 'b'], [11443, 159, 43, 81, 'g'], [11486, 178, 41, 62, 'g'], [11527, 158, 33, 82, 'g'], [11560, 179, 16, 61, 'g'], [11576, 172, 22, 68, 'g'], [11598, 160, 50, 80, 'g'], [11648, 188, 22, 52, 'g'], [11670, 188, 22, 52, 'g'], [11692, 160, 50, 80, 'g'], [11742, 172, 22, 68, 'g'], [11764, 179, 16, 61, 'g'], [11780, 158, 33, 82, 'g'], [11813, 178, 40, 62, 'g'], [11853, 159, 44, 81, 'g'], [11897, 159, 102, 8, 'b'], [11999, 169, 57, 71, 'g'], [12056, 135, 13, 105, 'g'], [12069, 135, 106, 8, 'b'], [12175, 135, 24, 19, 'g'], [12175, 154, 24, 86, 'g'], [12199, 147, 21, 93, 'g'], [12220, 173, 30, 67, 'g'], [15150, 186, 23, 54, 'g'], [15173, 148, 59, 92, 'g'], [15232, 148, 14, 92, 'g'], [15516, 148, 16, 92, 'g'], [15532, 154, 60, 86, 'g'], [15592, 106, 18, 134, 'g'], [15610, 106, 101, 8, 'b'], [15711, 155, 19, 85, 'g'], [15730, 164, 58, 76, 'g'], [15788, 164, 81, 76, 'g'], [15869, 114, 76, 126, 'g'], [15945, 172, 20, 68, 'g'], [15965, 162, 70, 78, 'g'], [16035, 156, 39, 84, 'g'], [16074, 156, 14, 84, 'g'], [16496, 156, 16, 84, 'g'], [16512, 162, 59, 78, 'g'], [16571, 172, 10, 68, 'g'], [16581, 172, 87, 68, 'g'], [16668, 136, 49, 104, 'g'], [16717, 136, 67, 104, 'g'], [16784, 172, 83, 68, 'g'], [17281, 156, 43, 84, 'g'], [17324, 136, 76, 104, 'g'], [17400, 172, 70, 68, 'g'], [17470, 172, 69, 68, 'g'], [17539, 148, 52, 92, 'g'], [17640, 187, 151, 53, 'g'], [17791, 179, 50, 61, 'g'], [17841, 171, 56, 69, 'g'], [17897, 162, 67, 78, 'g'], [17964, 156, 49, 84, 'g'], [18013, 128, 107, 112, 'g'], [12250, 190, 250, 50, 'g'], [12500, 226, 1000, 14, 'g'], [13500, 190, 550, 50, 'g'], [13650, 100, 120, 64, 'r'], [13950, 100, 140, 64, 'r'], [14050, 226, 400, 14, 'g'], [14450, 190, 200, 50, 'g'], [12890, 60, 60, 70, 'r'], [13150, 110, 70, 8, 'm'], [14650, 190, 500, 50, 'g'], [1595, 196, 34, 8, 'l'], [1845, 200, 34, 8, 'l'], [1552, 62, 46, 6, 'p'], [1614, 50, 46, 6, 'p'], [1676, 70, 46, 6, 'p'], [1738, 54, 46, 6, 'p'], [1800, 68, 46, 6, 'p'], [1521, 26, 46, 6, 'p'], [1591, 20, 46, 6, 'p'], [1661, 30, 46, 6, 'p'], [1730, 23, 46, 6, 'p'], [1800, 26, 46, 6, 'p'], [4336, 196, 34, 8, 'l'], [4586, 200, 34, 8, 'l'], [4293, 62, 46, 6, 'p'], [4355, 50, 46, 6, 'p'], [4417, 70, 46, 6, 'p'], [4479, 54, 46, 6, 'p'], [4541, 68, 46, 6, 'p'], [4259, 26, 46, 6, 'p'], [4329, 20, 46, 6, 'p'], [4400, 30, 46, 6, 'p'], [4471, 23, 46, 6, 'p'], [4541, 26, 46, 6, 'p'], [16875, 196, 34, 8, 'l'], [17025, 196, 34, 8, 'l'], [17225, 198, 34, 8, 'l'], [16832, 62, 46, 6, 'p'], [16894, 50, 46, 6, 'p'], [16956, 70, 46, 6, 'p'], [17018, 54, 46, 6, 'p'], [17080, 68, 46, 6, 'p'], [17142, 52, 46, 6, 'p'], [17204, 62, 46, 6, 'p'], [16775, 26, 46, 6, 'p'], [16847, 20, 46, 6, 'p'], [16918, 30, 46, 6, 'p'], [16989, 23, 46, 6, 'p'], [17061, 26, 46, 6, 'p'], [17133, 20, 46, 6, 'p'], [17204, 30, 46, 6, 'p'], [4594, 162, 30, 8, 'm'], [17247, 162, 30, 8, 'm'], [1900, 159, 30, 8, 'm'], [2155, 143, 30, 8, 'm'], [3079, 139, 30, 8, 'm'], [4220, 131, 30, 8, 'm'], [4800, 159, 30, 8, 'm'], [5055, 143, 30, 8, 'm'], [15562, 130, 30, 8, 'm'], [15839, 139, 30, 8, 'm']],w:[[0, 12500, 214, 0, 1], [12500, 1000, 150, 1], [13500, 550, 214, 0, 1], [14050, 400, 150, 1], [14450, 3670, 214, 0, 1]],v:[[1575, 62, 141, 1, 1], [1544, 26, 141, 1, 1], [4316, 62, 152, 1, 1], [4282, 26, 152, 1, 1], [16855, 62, 170, 1, 1], [16798, 26, 170, 1, 1], [15586, 106, 152, 1]],sk:[],e:[[12,1730,1730,1730,122,30],[12,4471,4471,4471,122,30],[12,8125,8125,8125,122,34],[12,8664,8664,8664,122,34],[12,9389,9389,9389,122,34],[12,14195,14195,14195,122,34],[12,17010,17010,17010,122,30],[8,290,225,335,156],[8,1440,1385,1495,154],[8,4190,4155,4235,155],[13,1335,1335,1335,154],[13,6350,6350,6350,176],[13,7700,7700,7700,170],[13,7895,7895,7895,170],[13,6765,6765,6765,176],[13,7175,7175,7175,176],[13,3050,3050,3050,164],[13,11122,11122,11122,147],[9,12400,12400,12400,190],[9,13590,13590,13590,190],[9,15680,15680,15680,106],[9,14570,14570,14570,190],[9,16740,16740,16740,136],[13,13880,13880,13880,190],[13,10249,10249,10249,169],[10,10945,10912,10985,135],[13,11407,11407,11407,169],[13,12138,12138,12138,135],[10,11950,11920,11976,159],[8,10052,10010,10088,173],[8,10780,10743,10816,159],[8,11188,11170,11205,173],[8,11232,11220,11248,173],[8,17541,17541,17541,148],[10,17562,17562,17562,148],[11,17500,17500,17500,172],[2, 904, 780, 1028, 222], [2, 2564, 2414, 2715, 222], [2, 3403, 3299, 3507, 222], [2, 15361, 15256, 15466, 222], [2, 16272, 16098, 16446, 222], [2, 5603, 5547, 5659, 222], [2, 6016, 5960, 6072, 222], [2, 6429, 6373, 6485, 222], [2, 6842, 6786, 6898, 222], [2, 7255, 7199, 7311, 222], [2, 830, 774, 1034, 222], [2, 2464, 2408, 2721, 222], [2, 3349, 3293, 3513, 222], [2, 15306, 15250, 15472, 222], [2, 16148, 16092, 16452, 222], [2, 8040, 7930, 8220, 222], [2, 8710, 8600, 8890, 222], [2, 9380, 9270, 9560, 222], [5, 362, 350, 363, 154], [3, 419, 401, 429, 129], [5, 571, 564, 576, 134], [3, 687, 681, 720, 172], [0, 1136, 1102, 1157, 166], [3, 1968, 1938, 1968, 138], [3, 2113, 2093, 2119, 162], [0, 2216, 2183, 2221, 114], [0, 2347, 2340, 2360, 164], [3, 2852, 2832, 2864, 136], [3, 2924, 2908, 2934, 172], [0, 2978, 2978, 2998, 164], [3, 3134, 3117, 3149, 114], [5, 3218, 3213, 3245, 162], [3, 3595, 3581, 3620, 172], [5, 3786, 3780, 3829, 172], [5, 3889, 3877, 3898, 162], [0, 4045, 4002, 4057, 166], [0, 4277, 4276, 4298, 154], [5, 4648, 4636, 4657, 148], [5, 4850, 4838, 4874, 138], [0, 4998, 4993, 5025, 162], [0, 5109, 5083, 5121, 114], [0, 5323, 5298, 5513, 176], [3, 5422, 5298, 5507, 176], [5, 5412, 5298, 5513, 176], [7, 5907, 5711, 5908, 176], [5, 5740, 5711, 5926, 176], [7, 5711, 5711, 5908, 176], [7, 6275, 6124, 6321, 176], [7, 6177, 6124, 6321, 176], [7, 6278, 6124, 6321, 176], [0, 6574, 6537, 6752, 176], [0, 6734, 6537, 6752, 176], [7, 6635, 6537, 6734, 176], [0, 7099, 6950, 7165, 176], [0, 7044, 6950, 7165, 176], [3, 7100, 6950, 7159, 176], [5, 7461, 7363, 7580, 176], [0, 7421, 7363, 7580, 176], [0, 7411, 7363, 7580, 176], [5, 7718, 7618, 7890, 170], [3, 7865, 7618, 7884, 170], [3, 7671, 7618, 7884, 170], [3, 8418, 8288, 8554, 170], [4, 8419, 8288, 8564, 170], [7, 8413, 8288, 8542, 170], [0, 8993, 8958, 9230, 170], [3, 8995, 8958, 9224, 170], [7, 9010, 8958, 9212, 170], [0, 9838, 9628, 9900, 170], [0, 9718, 9628, 9900, 170], [5, 9695, 9628, 9900, 170], [0, 10146, 10132, 10151, 169], [0, 11292, 11292, 11311, 169], [0, 11610, 11606, 11618, 160], [5, 11864, 11861, 11867, 159], [0, 12011, 12007, 12026, 169], [5, 15541, 15540, 15562, 154], [3, 15898, 15877, 15909, 114], [3, 15975, 15973, 15999, 162], [4, 16620, 16589, 16642, 172], [3, 16829, 16792, 16831, 172], [0, 17337, 17332, 17370, 136], [3, 17421, 17408, 17434, 172], [4, 17722, 17648, 17765, 187], [3, 17717, 17648, 17755, 187], [5, 17799, 17799, 17811, 179], [0, 17849, 17849, 17867, 171], [3, 17920, 17905, 17928, 162], [3, 18022, 18021, 18084, 128], [1, 507, 452, 562, 105], [1, 668, 613, 723, 141], [1, 1165, 1110, 1220, 120], [1, 1376, 1321, 1431, 108], [1, 1501, 1446, 1556, 128], [1, 2053, 1998, 2108, 110], [1, 2190, 2135, 2245, 68], [1, 2371, 2316, 2426, 118], [1, 2865, 2810, 2920, 90], [1, 3065, 3010, 3120, 107], [1, 3205, 3150, 3260, 116], [1, 3569, 3514, 3624, 116], [1, 3718, 3663, 3773, 115], [1, 3934, 3879, 3989, 136], [1, 4070, 4015, 4125, 120], [1, 4226, 4171, 4281, 127], [1, 4773, 4718, 4828, 110], [1, 5055, 5000, 5110, 116], [1, 5228, 5173, 5283, 107], [1, 5425, 5370, 5480, 130], [1, 5744, 5689, 5799, 130], [1, 6130, 6075, 6185, 130], [1, 6275, 6220, 6330, 130], [1, 6632, 6577, 6687, 130], [1, 7000, 6945, 7055, 130], [1, 7156, 7101, 7211, 130], [1, 7470, 7415, 7525, 130], [1, 7679, 7624, 7734, 124], [1, 7827, 7772, 7882, 124], [1, 8284, 8229, 8339, 124], [1, 8485, 8430, 8540, 124], [1, 8995, 8940, 9050, 124], [1, 9203, 9148, 9258, 124], [1, 9712, 9657, 9767, 124], [1, 9812, 9757, 9867, 124], [1, 9997, 9942, 10052, 127], [1, 10201, 10146, 10256, 134], [1, 10378, 10323, 10433, 112], [1, 10514, 10459, 10569, 142], [1, 10663, 10608, 10718, 132], [1, 10864, 10809, 10919, 123], [1, 11030, 10975, 11085, 127], [1, 11188, 11133, 11243, 139], [1, 11346, 11291, 11401, 134], [1, 11590, 11535, 11645, 126], [1, 11694, 11639, 11749, 114], [1, 11907, 11852, 11962, 134], [1, 12033, 11978, 12088, 123], [1, 15668, 15613, 15723, 127], [1, 15780, 15725, 15835, 118], [1, 15980, 15925, 16035, 116], [1, 16659, 16604, 16714, 126], [1, 16796, 16741, 16851, 126], [1, 17315, 17260, 17370, 110], [1, 17540, 17485, 17595, 102], [1, 17848, 17793, 17903, 125], [6, 640, 570, 710, 80], [6, 1113, 1043, 1183, 96], [6, 1324, 1254, 1394, 103], [6, 1533, 1463, 1603, 73], [6, 1991, 1921, 2061, 68], [6, 2263, 2193, 2333, 83], [6, 2962, 2892, 3032, 102], [6, 3182, 3112, 3252, 44], [6, 3575, 3505, 3645, 102], [6, 3817, 3747, 3887, 102], [6, 4051, 3981, 4121, 96], [6, 4299, 4229, 4369, 84], [6, 4749, 4679, 4819, 114], [6, 5008, 4938, 5078, 92], [6, 5211, 5141, 5281, 83], [6, 5433, 5363, 5503, 106], [6, 5721, 5651, 5791, 106], [6, 5862, 5792, 5932, 106], [6, 6134, 6064, 6204, 106], [6, 6560, 6490, 6630, 106], [6, 7066, 6996, 7136, 106], [6, 7540, 7470, 7610, 106], [6, 7753, 7683, 7823, 100], [6, 8452, 8382, 8522, 100], [6, 9088, 9018, 9158, 100], [6, 9792, 9722, 9862, 100], [6, 10068, 9998, 10138, 115], [6, 10272, 10202, 10342, 110], [6, 10547, 10477, 10617, 90], [6, 10790, 10720, 10860, 110], [6, 10937, 10867, 11007, 115], [6, 11210, 11140, 11280, 115], [6, 11399, 11329, 11469, 110], [6, 11676, 11606, 11746, 118], [6, 11932, 11862, 12002, 110], [6, 12136, 12066, 12206, 115], [6, 15591, 15521, 15661, 84], [6, 15831, 15761, 15901, 83], [6, 16001, 15931, 16071, 92], [6, 16505, 16435, 16575, 86], [6, 16741, 16671, 16811, 91], [6, 17445, 17375, 17515, 102], [2, 17610, 17596, 17628, 222], [1, 12750, 12550, 13150], [0, 13750, 13530, 13940], [1, 14200, 14100, 14350], [2, 12950, 12570, 13350, 160], [2, 14200, 14100, 14400, 160], [2, 13250, 12670, 13450, 160], [3, 14830, 14680, 15082, 190], [6, 5623, 5573, 5673, 91], [6, 6036, 5986, 6086, 91], [6, 6449, 6399, 6499, 91], [6, 6862, 6812, 6912, 91], [6, 7275, 7225, 7325, 91], [6, 924, 800, 1048, 87], [6, 2584, 2434, 2735, 79], [6, 3423, 3319, 3527, 77], [6, 15381, 15276, 15486, 63], [6, 16292, 16118, 16466, 71], [1, 8100, 7960, 8240, 100], [6, 8160, 7960, 8240, 70], [1, 8770, 8630, 8910, 100], [6, 8830, 8630, 8910, 70], [1, 9440, 9300, 9580, 100], [6, 9500, 9300, 9580, 70]],it:[['gemB', 924, 132], ['gemG', 1612, 178], ['gemG', 1712, 182], ['gemG', 1812, 180], ['gemB', 1637, 36], ['gemB', 1699, 56], ['gemB', 1761, 40], ['gemB', 1823, 54], ['gemG', 1614, 6], ['gemG', 1684, 16], ['gemG', 1753, 9], ['gemG', 1823, 12], ['kit', 1699, 48], ['gemB', 2584, 124], ['gemB', 3423, 122], ['gemG', 4353, 178], ['gemG', 4453, 182], ['gemG', 4553, 180], ['gemB', 4378, 36], ['gemB', 4440, 56], ['gemB', 4502, 40], ['gemB', 4564, 54], ['gemG', 4352, 6], ['heart', 4423, 16], ['gemG', 4494, 9], ['gemG', 4564, 12], ['gemB', 15381, 108], ['gemB', 16292, 116], ['gemG', 16892, 178], ['gemG', 16992, 182], ['gemG', 17092, 180], ['gemG', 17192, 178], ['gemB', 16917, 36], ['gemB', 16979, 56], ['gemB', 17041, 40], ['gemB', 17103, 54], ['gemB', 17165, 38], ['gemB', 17227, 48], ['gemG', 16870, 6], ['gemG', 16941, 16], ['gemG', 17012, 9], ['gemG', 17084, 12], ['gemG', 17156, 6], ['gemG', 17227, 16], ['kit', 16979, 48], ['gemB', 5623, 136], ['gemB', 6036, 136], ['gemB', 6449, 136], ['gemB', 6862, 136], ['gemB', 7275, 136], ['gemB', 924, 132], ['gemB', 2584, 124], ['gemB', 3423, 122], ['gemB', 15381, 108], ['gemB', 16292, 116], ['gemB', 10566, 121], ['gemB', 10501, 114], ['gemB', 10428, 121], ['gemB', 10362, 121], ['gemB', 10296, 121], ['gemB', 10454, 121], ['gemB', 10518, 114], ['gemB', 10591, 121], ['gemB', 10658, 121], ['gemB', 10724, 121], ['gemB', 11726, 121], ['gemB', 11661, 114], ['gemB', 11588, 121], ['gemB', 11522, 121], ['gemB', 11456, 121], ['gemB', 11614, 121], ['gemB', 11678, 114], ['gemB', 11751, 121], ['gemB', 11818, 121], ['gemB', 11884, 121], ['gemB', 7988, 172], ['gemB', 8056, 138], ['gemB', 8124, 138], ['gemB', 8194, 138], ['gemB', 8240, 137], ['gemB', 8274, 138], ['gemB', 8664, 138], ['gemB', 8732, 138], ['gemB', 8800, 138], ['gemB', 8867, 116], ['gemB', 8935, 138], ['gemB', 9321, 116], ['gemB', 9389, 138], ['gemB', 9457, 138], ['gemB', 9525, 138], ['gemB', 9580, 138], ['gemB', 9614, 138], ['gemG', 103, 156], ['gemG', 178, 120], ['gemG', 237, 140], ['gemB', 300, 161], ['gemG', 367, 138], ['gemG', 429, 113], ['gemG', 483, 88], ['gemB', 528, 135], ['gemG', 581, 118], ['gemB', 628, 134], ['gemG', 714, 156], ['gemG', 1140, 150], ['gemG', 1208, 153], ['gemB', 1299, 157], ['gemG', 1398, 138], ['gemB', 1466, 158], ['gemG', 1558, 127], ['gemG', 1910, 165], ['gemG', 1967, 122], ['gemG', 2065, 140], ['gemG', 2120, 146], ['gemG', 2213, 98], ['gemB', 2291, 137], ['gemG', 2361, 148], ['gemG', 2802, 140], ['gemG', 2862, 120], ['gemG', 2935, 156], ['gemG', 2999, 148], ['gemB', 3068, 137], ['gemG', 3147, 98], ['gemG', 3240, 146], ['gemG', 3614, 156], ['gemB', 3689, 145], ['gemG', 3747, 120], ['gemG', 3815, 156], ['gemG', 3898, 146], ['gemB', 3961, 166], ['gemG', 4040, 150], ['gemG', 4108, 153], ['gemB', 4199, 157], ['gemG', 4298, 138], ['gemG', 4657, 132], ['gemB', 4734, 168], ['gemG', 4810, 165], ['gemG', 4867, 122], ['gemG', 4965, 140], ['gemG', 5020, 146], ['gemG', 5113, 98], ['gemB', 5191, 137], ['gemG', 5261, 148], ['gemG', 5416, 160], ['gemG', 5829, 160], ['gemG', 6242, 160], ['gemG', 6655, 160], ['gemG', 7068, 160], ['gemG', 7482, 160], ['gemG', 7765, 154], ['gemG', 8435, 154], ['gemG', 9105, 154], ['gemG', 9775, 154], ['gemB', 10057, 169], ['gemG', 10152, 153], ['gemB', 10232, 164], ['gemG', 10304, 143], ['gemG', 10346, 162], ['gemG', 10463, 144], ['gemG', 10557, 144], ['gemG', 10673, 162], ['gemG', 10715, 143], ['gemB', 10788, 164], ['gemG', 10867, 153], ['gemB', 10962, 169], ['gemB', 11217, 169], ['gemG', 11312, 153], ['gemB', 11392, 164], ['gemG', 11464, 143], ['gemG', 11506, 162], ['gemG', 11623, 144], ['gemG', 11717, 144], ['gemG', 11833, 162], ['gemG', 11875, 143], ['gemB', 11948, 164], ['gemG', 12027, 153], ['gemB', 12122, 169], ['gemG', 15202, 132], ['gemG', 15562, 138], ['gemB', 15660, 157], ['gemG', 15759, 148], ['gemB', 15828, 137], ['gemG', 15907, 98], ['gemG', 16000, 146], ['gemG', 16054, 140], ['gemG', 16541, 146], ['gemG', 16624, 156], ['gemG', 16692, 120], ['gemB', 16750, 145], ['gemG', 16825, 156], ['gemG', 17302, 140], ['gemG', 17362, 120], ['gemG', 17435, 156], ['gemB', 17504, 158], ['gemG', 17565, 132], ['gemG', 17715, 171], ['gemG', 17816, 163], ['gemG', 17869, 155], ['gemG', 17930, 146], ['gemG', 17988, 140], ['gemG', 18066, 112], ['knife', 714, 156], ['knife', 1558, 127], ['knife', 2361, 148], ['knife', 2999, 148], ['knife', 3747, 120], ['knife', 4298, 138], ['knife', 5113, 98], ['knife', 5829, 160], ['knife', 6655, 160], ['knife', 7068, 160], ['knife', 7765, 154], ['knife', 8435, 154], ['knife', 9105, 154], ['knife', 10152, 153], ['knife', 10715, 143], ['knife', 11464, 143], ['knife', 12027, 153], ['knife', 12027, 153], ['knife', 12027, 153], ['knife', 15202, 132], ['knife', 15202, 132], ['knife', 15562, 138], ['knife', 16541, 146], ['knife', 16825, 156], ['knife', 17715, 171], ['mach', 714, 156], ['heart', 1208, 153], ['kit', 2361, 148], ['heart', 3240, 146], ['kit', 4657, 132], ['heart', 5416, 160], ['kit', 6655, 160], ['heart', 7765, 154], ['kit', 9105, 154], ['heart', 10152, 153], ['kit', 11312, 153], ['heart', 12027, 153], ['kit', 12027, 153], ['heart', 15202, 132], ['kit', 15562, 138], ['heart', 16624, 156], ['kit', 17715, 171], ['gemG', 12650, 200], ['gemB', 12850, 190], ['gemG', 13050, 170], ['heart', 13185, 95], ['gemB', 13350, 200], ['knife', 13600, 176], ['gemG', 13700, 176], ['gemB', 13900, 176], ['gemG', 14150, 200], ['kit', 14300, 205], ['gemB', 14350, 200], ['gemG', 14770, 174], ['gemB', 14890, 174]],sw:[[1637, 58, 72, 0], [1699, 78, 72, 0], [1761, 62, 72, 0], [1823, 76, 72, 0], [4378, 58, 72, 0], [4440, 78, 72, 0], [4502, 62, 72, 0], [4564, 76, 72, 0], [16917, 58, 72, 0], [16979, 78, 72, 0], [17041, 62, 72, 0], [17103, 76, 72, 0], [17165, 60, 72, 0], [17227, 70, 72, 0], [10551, 32, 107, 0], [10486, 22, 110, 0], [10516, 22, 110, 0], [10413, 51, 88, 0], [10443, 51, 88, 0], [10347, 45, 94, 0], [10377, 45, 94, 0], [10281, 54, 85, 0], [10311, 54, 85, 0], [10469, 32, 107, 0], [10503, 22, 110, 0], [10533, 22, 110, 0], [10576, 51, 88, 0], [10606, 51, 88, 0], [10643, 45, 94, 0], [10673, 45, 94, 0], [10709, 54, 85, 0], [10739, 54, 85, 0], [11711, 32, 107, 0], [11646, 22, 110, 0], [11676, 22, 110, 0], [11573, 51, 88, 0], [11603, 51, 88, 0], [11507, 45, 94, 0], [11537, 45, 94, 0], [11441, 54, 85, 0], [11471, 54, 85, 0], [11629, 32, 107, 0], [11663, 22, 110, 0], [11693, 22, 110, 0], [11736, 51, 88, 0], [11766, 51, 88, 0], [11803, 45, 94, 0], [11833, 45, 94, 0], [11869, 54, 85, 0], [11899, 54, 85, 0], [7939, 134, 52, 0], [7969, 134, 52, 0], [8007, 98, 54, 0], [8037, 98, 54, 0], [8075, 98, 54, 0], [8105, 98, 54, 0], [8145, 75, 77, 0], [8175, 75, 77, 0], [8191, 88, 63, 0], [8221, 88, 63, 0], [8225, 98, 54, 0], [8255, 98, 54, 0], [8615, 98, 54, 0], [8645, 98, 54, 0], [8683, 98, 54, 0], [8713, 98, 54, 0], [8751, 98, 54, 0], [8781, 98, 54, 0], [8818, 38, 92, 0], [8848, 38, 92, 0], [8886, 98, 54, 0], [8916, 98, 54, 0], [9272, 38, 92, 0], [9302, 38, 92, 0], [9340, 98, 54, 0], [9370, 98, 54, 0], [9408, 98, 54, 0], [9438, 98, 54, 0], [9476, 98, 54, 0], [9506, 98, 54, 0], [9531, 94, 58, 0], [9561, 94, 58, 0], [9565, 98, 54, 0], [9595, 98, 54, 0], [17592, 108, 60, 152], [14062, 100, 75, 192], [14088, 100, 75, 0], [14136, 104, 75, 0], [14164, 104, 75, 0], [14226, 104, 75, 0], [14254, 104, 75, 0], [14316, 104, 75, 0], [14344, 104, 75, 0]],pal:[[8165, 67, 214], [8833, 30, 214], [9287, 30, 214], [9535, 86, 214], [8125, 26, 214], [8664, 26, 214], [9389, 26, 214], [14195, 26, 214], [1575, 62, 146], [1637, 50, 214], [1699, 70, 214], [1761, 54, 214], [1823, 68, 214], [1544, 26, 146], [1614, 20, 214], [1684, 30, 214], [1753, 23, 214], [1823, 26, 214], [4316, 62, 157], [4378, 50, 214], [4440, 70, 214], [4502, 54, 214], [4564, 68, 214], [4282, 26, 157], [4352, 20, 214], [4423, 30, 214], [4494, 23, 214], [4564, 26, 214], [16855, 62, 175], [16917, 50, 214], [16979, 70, 214], [17041, 54, 214], [17103, 68, 214], [17165, 52, 214], [17227, 62, 214], [16798, 26, 175], [16870, 20, 214], [16941, 30, 214], [17012, 23, 214], [17084, 26, 214], [17156, 20, 214], [17227, 30, 214], [8022, 92, 214], [8090, 92, 214], [8240, 92, 214], [8630, 92, 214], [8698, 92, 214], [8766, 92, 214], [8901, 92, 214], [9355, 92, 214], [9423, 92, 214], [9491, 92, 214], [9580, 92, 214], [14150, 96, 214], [14240, 96, 214], [14330, 96, 214]],hl:[[5543, 5703, 176], [5956, 6116, 176], [6369, 6529, 176], [6782, 6942, 176], [7195, 7355, 176], [770, 1078, 172], [2404, 2765, 164], [3289, 3557, 162], [15246, 15516, 148], [16088, 16496, 156]],ms:[[9950, 'PALM GROVE  VINES HANG FROM THE BIG PALMS'], [5300, 'ROPE HOLES  CROUCH AT THE EDGE'], [7650, 'PALM JUNGLE  SWING FROM VINE TO VINE'], [12400, 'RIVER CAVES  SWIM WITH THE ARROWS'], [13580, 'CROUCH TO CRAWL UNDER THE LOGS']],mp:[[5543, 22, 176, 208, 0], [5681, 22, 176, 208, 2.2], [5956, 22, 176, 208, 0], [6094, 22, 176, 208, 2.2], [6369, 22, 176, 208, 0], [6507, 22, 176, 208, 2.2], [6782, 22, 176, 208, 0], [6920, 22, 176, 208, 2.2], [7195, 22, 176, 208, 0], [7333, 22, 176, 208, 2.2], [770, 22, 172, 208, 0], [1056, 22, 172, 208, 2.2], [2404, 22, 164, 206, 0], [2743, 22, 164, 206, 2.2], [3289, 22, 162, 204, 0], [3535, 22, 162, 204, 2.2], [15246, 22, 148, 190, 0], [15494, 22, 148, 190, 2.2], [16088, 22, 156, 198, 0], [16474, 22, 156, 198, 2.2], [7920, 22, 170, 208, 1.0], [8258, 22, 170, 208, 3.3], [8590, 22, 170, 208, 1.0], [8928, 22, 170, 208, 3.3], [9260, 22, 170, 208, 1.0], [9598, 22, 170, 208, 3.3]]}];
    function loadLevel() {
        L = LV[LI];
        sd = 11;
        if (LI === LV.length - 1 && !L.bx) {
            L.bx = [17780, 17950];
            L.s = L.s.filter(function (s) {
                return !(s[0] >= 17780 && s[0] <= 17970);
            });
            L.s.push([17791, 187, 194, 53, 'g'], [17985, 160, 40, 80, 'g']);
            L.e = L.e.filter(function (q) {
                return !(q[3] >= 17640 && q[2] <= 18010);
            });
            L.it = L.it.filter(function (q) {
                return !(q[1] >= 17780 && q[1] <= 18010);
            });
            L.it.push(['knife', 17668, 171], ['knife', 17696, 171], ['heart', 17745, 171], ['heart', 17760, 171]);
        }
        if (L.ms)
            L.ms.forEach(function (q) {
                q.d = 0;
            });
        if (!L.k2) {
            L.k2 = 1;
            L.e = L.e.filter(function (q) {
                return q[0] !== 2;
            }).concat([
                [2, 521, 500, 542, 104], [2, 1192, 1168, 1216, 166], [2, 3054, 3013, 3095, 164],
                [2, 3671, 3633, 3709, 172], [2, 4092, 4068, 4116, 166], [2, 4729, 4714, 4744, 186],
                [2, 9928, 9910, 9946, 170], [2, 12948, 12898, 12998, 226], [2, 13256, 13206, 13306, 226],
                [2, 14204, 14154, 14254, 226], [2, 15758, 15744, 15772, 164], [2, 15828, 15801, 15855, 164],
                [2, 16696, 16682, 16710, 136], [2, 14590, 14540, 14640, 190]
            ]);
        }
        EN = L.e.map(function (q) {
            var k = q[0];
            var h = ED[k][1];
            return {
                k: k,
                ry: q[5],
                x: q[1],
                a: q[2],
                b: q[3],
                y: k === 1 || k === 6 ? q[4] || 140 : k === 12 ? (q[4] || 190) - CHM_LIFT - h : (q[4] || 190) - h,
                y0: k === 1 || k === 6 ? q[4] || 140 : 0,
                w: ED[k][0],
                h: h,
                hp: k === 2 || k === 4 ? 3 : k === 7 ? 4 : k === 8 ? 4 : k === 9 ? ARC_HP : k === 13 ? ARC2_HP : k === 10 ? GOR_HP : k === 11 ? WB_HP : k === 12 ? CHM_HP : 0,
                hc: 0,
                d: -1,
                t: rn() * 20,
                dead: 0
            };
        });
        spikesInit();
        EN.forEach(function (e) {
            e.sx = e.x;
            e.sy = e.y;
            e.hp0 = e.hp;
            e.rt = 0;
            e.at = 0;
            e.ac = 0;
            e.ap = -1;
            e.ac2 = 0;
            e.ia = 0;
            e.il = 0;
            e.gs = 0;
            e.cd = 0;
            e.gt = 0;
            e.wk = 0;
            e.it = 0;
            e.gy = e.sy + e.h;
            e.cs = 0;
            e.cc = 60 + rn() * 140;
            e.cp = 0;
            e.vx = e.sx;
        });
        AR = [];
        CC = [];
        IT = L.it.map(function (q) {
            return { n: q[0], x: q[1], y: q[2], got: 0 };
        });
        if (RED_GEMS_ON && LI === 0)
            RED_GEMS.forEach(function (q) {
                IT.push({ n: 'gemR', x: q[0], y: q[1], got: 0 });
            });
        PR = [];
        PA = [];
        DEC = [];
        HL = (L.hl || []).map(function (q) {
            return { x0: q[0], x1: q[1], yG: q[2], ry: q[2] - 26 };
        });
        MP = (L.mp || []).map(function (q) {
            return { x: q[0], w: q[1], t: q[2], b: q[3], ph: q[4], y: q[3], dy: 0 };
        });
        SW = (L.sw || []).map(function (q) {
            return { x: q[0], y: q[1], len: q[2], pb: q[3], th: 0, om: 0, ph: rn() * 6 };
        });
        var SM = ['f1', 'f2', 'f3', 'ps', 'fl1', 'fl2', 'rk'], BG2 = ['pm', 'pb', 'pt', 'bush'];
        L.s.forEach(function (s) {
            if (s[4] !== 'g' || s[1] > 200)
                return;
            for (var px = s[0] + 14; px < s[0] + s[2] - 14; px += s[0] < 1600 ? 15 + rn() * 16 : 30 + rn() * 34) {
                var f = rn() < 0.3, l = f ? SM : SM.concat(BG2);
                DEC.push({ n: l[rn() * l.length | 0], x: px, y: s[1] + 4, f: f });
                if (s[0] < 2200 && rn() < 0.22)
                    DEC.push({ n: 'trunkT', x: px + 6, y: s[1] + 4, f: 0 });
            }
        });
        /* swim pools: a trunk at the start and at the end of every swimming water zone (top flush with the water surface) so the hero has something to jump onto, and the water no longer stops abruptly */
        (L.w || []).forEach(function (z) {
            if (!z[3])
                return;
            DEC.push({ n: 'wpillar', x: z[0] - 30, y: z[2] + PIL_H, f: 0 });
            DEC.push({ n: 'wpillar', x: z[0] + z[1] - 3, y: z[2] + PIL_H, f: 0 });
        });
        /* tree trunks (trunkT): the flat top is a one-way platform you can stand on (jump up through it from below); the trunk itself is still
     drawn behind the hero and you can walk through it. If nothing else lets you reach the top, a log branch on its left side is the first step. */
        if (!L.trk) {
            L.trk = 1;
            DEC.filter(function (d) {
                return d.n === 'trunkT' || d.n === 'wpillar';
            }).sort(function (a, b) {
                return a.x - b.x;
            }).forEach(function (d) {
                var top = d.y - (d.n === 'wpillar' ? PIL_H : 63.8);
                L.s.push([d.x + 3, top + 1, 27, 6, 'p']);
                var reach = L.s.some(function (s) {
                    return s[4] !== 'p' && s[1] >= top + 12 && s[1] <= top + 40 && s[0] < d.x + 70 && s[0] + s[2] > d.x - 60;
                });
                if (!reach)
                    L.s.push([d.x - 20, top + 30, 26, 6, 'l']);
            });
        }
        P.x = 20;
        P.y = 110;
        P.vx = P.vy = 0;
        P.cp = 0;
        P.ls = null;
        P.lh = [];
        P.er = 0;
        G.fi = 0;
        P.cl = 0;
        P.inv = 60;
        P.on = 0;
        cam = 0;
        camY = 100;
        G.msg = L.n;
        G.mt = 180;
        bossInit();
        crocInit();
    }
    function startGame() {
        LI = 0;
        G = { run: 1, score: 0, gems: 0, bonus: 0, won: 0, msg: '', mt: 0 };
        P = {
            x: 20,
            y: 110,
            w: 10,
            h: 38,
            vx: 0,
            vy: 0,
            on: 0,
            face: 1,
            cr: 0,
            ct: 0,
            cl: 0,
            sw: 0,
            hp: 5,
            inv: 0,
            wp: 0,
            hasM: 1,
            ammo: 5,
            cd: 0,
            wh: 0,
            mh: 0,
            jb: 0,
            co: 0,
            ph: 0,
            cp: 0,
            sc: 0,
            fall: 0,
            sv: 0,
            hg: 0,
            hgT: 0,
            wt: 0,
            nsw: 0
        };
        K = {};
        T = 0;
        hudS = '';
        SB.last = '';
        loadLevel();
        cancelAnimationFrame(raf);
        show('game');
        jcGate(function () {
            last = performance.now();
            raf = requestAnimationFrame(loop);
        });
    }
    function stop() {
        cancelAnimationFrame(raf);
        G.run = 0;
        G.pause = 0;
        if (A.ctx && A.ctx.state === 'suspended')
            A.ctx.resume();
    }
    /* PAUSE (key P): freezes the game and the sound, shows PAUSED; P again continues. Esc still quits to the menu. */
    function pauseDraw() {
        if (A.ctx && A.ctx.state === 'running')
            A.ctx.suspend();
        x.save();
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.fillStyle = 'rgba(0,0,0,.55)';
        x.fillRect(0, 0, 800, 600);
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.shadowColor = '#000';
        x.shadowOffsetX = 3;
        x.shadowOffsetY = 3;
        x.fillStyle = '#ffd24a';
        x.font = '40px "Press Start 2P",monospace';
        x.fillText('PAUSED', 400, 278);
        x.shadowOffsetX = x.shadowOffsetY = 2;
        x.fillStyle = '#e8f5d8';
        x.font = '14px "Press Start 2P",monospace';
        x.fillText('PRESS P TO CONTINUE', 400, 330);
        x.restore();
    }
    function togglePause() {
        G.pause = !G.pause;
        G.pd = 0;
        if (!G.pause && A.ctx && A.ctx.state === 'suspended')
            A.ctx.resume();
    }
    function sol(b) {
        return L.s.some(function (s) {
            return (s[4] === 'g' || s[4] === 'r') && ov(b, { x: s[0], y: s[1], w: s[2], h: s[3] });
        });
    }
    function hurt(n, fx) {
        if (P.inv > 0 || !G.run)
            return;
        P.hp -= n;
        P.inv = HERO_HURT_INVULN;
        if (!sampSnd(HDIEB, 1))
            sfx(180, 0.3, 'sawtooth', 60);
        /* the scream plays every time a heart is lost */
        if (P.hp <= 0)
            die();
        else if (!fx && RESP_SAFE && RESP_HIT && !P.er && !(P.fall > 0) && !P.caught) {
            P.er = FADE_OUT;
            P.inv = FADE_OUT + 100;
            P.vx = P.vy = 0;
        }    /* fx=1: falling / crocodile / spikes already have their own respawn. Every other hit (enemies, arrows, coconuts, boss) = fade out and back BEFORE the enemies */
    }
    /* ---- RESPAWN: after losing a heart by falling / drowning / a crocodile she comes back a bit BEFORE the place where she died, on solid ground (the last safe
   spot she stood on, RESP_BACK units further back), not at the far checkpoint. RESP_SAFE=0 = old behaviour (checkpoint). The screen fades to black while she dies
   (FADE_OUT ticks) and fades back in after the respawn (FADE_IN ticks). ---- */
    function nearHole(px) {
        return HL.some(function (h) {
            return px > h.x0 - RESP_HOLE && px < h.x1 + RESP_HOLE;
        });
    }
    /* the water holes with crocodiles (and a margin around them) */
    function nearEn(px) {
        return EN.some(function (e) {
            return !e.dead && Math.abs(e.x + e.w / 2 - px) < RESP_ENEMY;
        });
    }
    /* RESP_ENEMY: she never respawns closer than this (units) to a living enemy */
    function safeSpot() {
        var h = P.lh || [], s = P.ls, i, c, d, best, list, pass;
        if (!s)
            return null;
        list = h.concat([{ x: s.x, y: s.y }]);
        for (pass = 0; pass < 3; pass++) {
            best = null;
            /* pass 0: same ground level, pass 1: any level (e.g. she dropped off a ledge), both away from enemies; pass 2: like pass 1 but ignoring enemies */
            for (i = list.length - 1; i >= 0; i--) {
                c = list[i];
                d = Math.abs(c.x - s.x);
                if (d > RESP_MAX || pass === 0 && Math.abs(c.y - s.y) > 40 || nearHole(c.x + P.w / 2) || pass < 2 && nearEn(c.x + P.w / 2))
                    continue;
                if (d >= RESP_BACK)
                    return c;
                if (!best)
                    best = c;
            }
            if (best)
                return best;
        }
        return null;
    }
    function rsp() {
        var sp = RESP_SAFE ? safeSpot() : null;
        if (sp) {
            P.x = sp.x;
            P.y = sp.y - 2;
        } else {
            P.x = L.c[P.cp];
            P.y = 110;
        }
        P.vx = P.vy = 0;
        P.cl = 0;
        P.sv = 0;
        P.vj = 0;
        P.sw = 0;
        P.hg = 0;
        P.mp = 0;
        P.er = 0;
        P.inv = 90;
        P.on = 0;
        if (P.cr) {
            P.cr = 0;
            P.h = 38;
        }
        G.fi = FADE_IN;
        if (typeof CRO !== 'undefined' && CRO)
            CRO.forEach(function (c) {
                if (c.cd < 200)
                    c.cd = 200;
            });
        cam = P.x - 95;
        camY = Math.max(-180, Math.min(100, P.y + P.h / 2 - 70));
    }
    function fadeA() {
        if (P.er > 0)
            return Math.min(1, 1 - P.er / FADE_OUT);
        if (P.fall > 0)
            return Math.min(1, 1 - P.fall / FADE_OUT);
        if (P.caught)
            return Math.max(0, Math.min(1, (P.caught.t - 58) / 60));
        return G.fi > 0 ? G.fi / FADE_IN : 0;
    }
    function fadeDraw() {
        var a = fadeA();
        if (a > 0.003) {
            x.save();
            x.setTransform(1, 0, 0, 1, 0, 0);
            x.fillStyle = 'rgba(0,0,0,' + Math.min(1, a) + ')';
            x.fillRect(0, 0, 800, 600);
            x.restore();
        }
    }
    function wet() {
        if (P.fall > 0)
            return;
        scream();
        P.fall = 70;
        P.vx = 0;
        P.sv = 0;
        P.vj = 0;
        P.cl = 0;
    }
    var BM = {
        'bw2': { 'w': 50.2, 'h': 58.33, 'ax': 27.5 },
        'bwk': { 'w': 50.2, 'h': 58.33, 'ax': 27.5 },
        'bsh': { 'w': 50.2, 'h': 58.33, 'ax': 27.5, 'mx': 0.5, 'my': 9.4 }
    };
    var BS = null, BB = [];
    /* boss: ticks between shots (60 = once per second) and bullet speed (was 2.3, 3 shots per burst) */
    function bossInit() {
        BS = null;
        BB = [];
        if (LI !== LV.length - 1 || !L.bx)
            return;
        BS = {
            x: L.bx[1] - 6,
            y: 187 - 56,
            w: 26,
            h: 56,
            hp: 12,
            hp0: 12,
            d: -1,
            t: 0,
            cool: 70,
            sh: 0,
            nx: 0,
            fl: 0,
            hc: 0,
            dead: 0,
            dt: 0,
            act: 0,
            mv: 0,
            wp: 0
        };
    }
    function bossCamOff() {
        var b = BS;
        if (!b || !b.act || b.dead)
            return 0;
        return Math.max(-60, Math.min(60, (b.x + b.w / 2 - (P.x + P.w / 2)) * 0.5));
    }
    function bossHit(n) {
        var b = BS;
        b.hp -= n;
        b.hc = 14;
        sfx(240, 0.12, 'square', 120);
        burst(b.x + b.w / 2, b.y + 22, '#c8d0a0');
        if (b.hp <= 0) {
            sampSnd(EBDIEB, 1);
            b.dead = 1;
            b.dt = 80;
            b.sh = 0;
            BB = [];
            G.score += 5000;
            G.msg = 'THE BOSS IS DOWN!  GO TO THE PRINCESS';
            G.mt = 260;
            for (var i = 0; i < 9; i++)
                burst(b.x + 4 + rn() * 18, b.y + rn() * 50, ['#ffd45a', '#ff7a2a', '#c8d0a0'][i % 3]);
            sfx(120, 0.5, 'sawtooth', 40);
        }
    }
    function bossFire() {
        var b = BS, m = BM.bsh, f = b.d, mx = b.x + b.w / 2 + f * (m.ax - m.mx), my = b.y + b.h - m.h + m.my, tx = P.x + P.w / 2, ty = P.y + P.h * 0.4, dx = tx - mx, dy = ty - my, l = Math.sqrt(dx * dx + dy * dy) || 1, sp = BOSS_BULLET_SPEED;
        BB.push({ x: mx, y: my, vx: dx / l * sp, vy: Math.max(-0.9, Math.min(0.9, dy / l * sp)), l: 300 });
        b.fl = 7;
        sfx(170, 0.09, 'sawtooth', 70);
    }
    function bossUpd(dt, mb) {
        var b = BS;
        if (!b)
            return;
        if (b.dead) {
            if (b.dt > 0)
                b.dt -= dt;
            else if (DANCE_ON && !b.dd && P.on && !P.sw && !P.cl && !P.hg && !P.sv && !P.cr && !P.caught && G.run && okSet(DANCEF)) {
                b.dd = 1;
                danceStart();
            }
            return;
        }
        var bcx = b.x + b.w / 2, pcx = P.x + P.w / 2, dist = Math.abs(pcx - bcx);
        if (!b.act && P.x > 17600) {
            b.act = 1;
            G.msg = 'END BOSS!  DEFEAT HIM TO REACH THE PRINCESS';
            G.mt = 240;
        }
        if (!b.act)
            return;
        if (P.x + P.w > 17982) {
            P.x = 17982 - P.w;
            if (P.vx > 0)
                P.vx = 0;
        }
        b.t += dt;
        if (b.hc > 0)
            b.hc -= dt;
        if (b.fl > 0)
            b.fl -= dt;
        b.d = pcx < bcx ? -1 : 1;
        b.mv = 0;
        if (b.sh > 0) {
            b.sh -= dt;
            if (b.nx > 0 && b.sh <= b.nx) {
                bossFire();
                b.nx = -1;
            }
            if (b.sh <= 0) {
                b.sh = 0;
                b.cool = BOSS_FIRE_TICKS - 24;
            }
        } else {
            b.cool -= dt;
            var mv = 0;
            if (dist > 105)
                mv = b.d;
            else if (dist < 48)
                mv = -b.d;
            if (mv) {
                var nx = Math.max(L.bx[0], Math.min(L.bx[1], b.x + mv * 0.3 * dt));
                b.mv = nx !== b.x ? 1 : 0;
                if (b.mv)
                    b.wp += (mv === b.d ? 1 : -1) * dt / BOSS_WALK_TPF;
                b.x = nx;
            }
            if (b.cool <= 0 && dist < 150) {
                b.sh = 24;
                b.nx = 17;
            }
        }
        var box = { x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 2 };
        if (mb && b.hc <= 0 && ov(mb, box))
            bossHit(1);
        PR.forEach(function (p) {
            if (p.l > 0 && b.hc <= 0 && !b.dead && ov({ x: p.x, y: p.y, w: 7, h: 3 }, box)) {
                p.l = 0;
                bossHit(1);
            }
        });
        if (!b.dead && ov({ x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 2 }, { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 4 }))
            hurt(1);
        BB.forEach(function (q) {
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            q.l -= dt;
            var r = { x: q.x - 1.5, y: q.y - 1.5, w: 3, h: 3 };
            if (sol(r))
                q.l = 0;
            if (q.l > 0 && ov(r, { x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 2 })) {
                q.l = 0;
                hurt(1);
            }
        });
        BB = BB.filter(function (q) {
            return q.l > 0;
        });
    }
    function bossDraw() {
        var b = BS;
        if (!b || b.dead && b.dt <= 0)
            return;
        var bcx = b.x + b.w / 2, feet = b.y + b.h, im, m, fl = b.fl > 0 && b.sh > 0;
        if (fl) {
            im = AS.bsh;
            m = BM.bsh;
        } else if (b.sh > 0 || !b.mv) {
            im = AS.bw2;
            m = BM.bw2;
        } else {
            var n = BWALKF.length || 1, k = ((Math.floor(b.wp) % n) + n) % n;
            im = BWALKF[k];
            m = BM.bwk;
        }
        if (im && im.naturalWidth) {
            x.save();
            if (b.dead)
                x.globalAlpha = Math.max(0, b.dt / 80) * ((b.dt / 3 | 0) % 2 ? 1 : 0.45);
            else if (b.hc > 0 && (b.hc | 0) % 4 < 2)
                x.globalAlpha = 0.55;
            if (b.d > 0) {
                x.translate(bcx, 0);
                x.scale(-1, 1);
                x.translate(-bcx, 0);
            }
            x.drawImage(im, bcx - m.ax, feet - m.h + 0.4, m.w, m.h);
            if (fl && AS.bfl && AS.bfl.naturalWidth) {
                x.globalCompositeOperation = 'lighter';
                x.globalAlpha = 0.55 + 0.45 * (b.fl / 7);
                x.drawImage(AS.bfl, bcx - (BM.bsh.ax - BM.bsh.mx) - 64 * 0.2083, feet - BM.bsh.h + 0.4 + BM.bsh.my - 46 * 0.2083, 240 * 0.2083, 282 * 0.2083);
            }
            x.restore();
        }
        BB.forEach(function (q) {
            x.fillStyle = '#ffe27a';
            x.beginPath();
            x.arc(q.x, q.y, 1.7, 0, 6.3);
            x.fill();
            x.strokeStyle = 'rgba(255,170,60,.6)';
            x.lineWidth = 1;
            x.beginPath();
            x.moveTo(q.x, q.y);
            x.lineTo(q.x - q.vx * 2.2, q.y - q.vy * 2.2);
            x.stroke();
        });
    }
    var CM = { 'w': 49.8, 'h': 29.26, 'ax': 27.1, 'gy': 28.44 };
    /* new crawl loop (45 pictures, the last 2 of the original 47 were removed for a smooth loop, face RIGHT). CRAWL_K = pictures per step of walking: bigger = faster legs (4.8 = the 24 pictures/second it was filmed at) */
    function CMI() {
        var n = (P.ph * CRAWL_K | 0) % FRAMES_HERO_CRAWL;
        return n < 10 ? '0' + n : '' + n;
    }
    /* ---- crocodiles: one in every rope hole (swim, turn around, lunge, bite, death roll) ---- */
    var CRM = {
            'sw': { 'w': 76.46, 'h': 29.79, 'ax': 38.19, 'by': 22.97 },
            'ct': { 'w': 91.67, 'h': 57.29, 'ax': 38.19, 'by': 35.47 }
        }, CRO = [];
    function crocInit() {
        CRO = (HL || []).map(function (hh, i) {
            var c = (hh.x0 + hh.x1) / 2, half = Math.max(6, (hh.x1 - hh.x0) / 2 - 46);
            return {
                c: c,
                x: c,
                sx: c,
                d: i % 2 ? 1 : -1,
                x0: c - half,
                x1: c + half,
                hx0: hh.x0,
                hx1: hh.x1,
                yb: 222,
                st: 0,
                t: 0,
                cd: 50 + i * 7,
                hp: 1,
                hp0: 1,
                dead: 0,
                rt: 0,
                hc: 0,
                tf: 1,
                bit: 0
            };
        });
    }
    /* REM ---- crocodile LUNGE attack (kept for later, disabled) ----------------------------------------
   The croc used to lunge and bite by itself whenever the hero hung over, swam in or stood low near its hole.
   To bring it back: delete the new crocUpd below and rename crocUpdLunge to crocUpd.
function crocReach(c){if(P.caught||P.fall>0||P.inv>0||!G.run)return false;var hx=P.x+P.w/2;if(hx<c.hx0-8||hx>c.hx1+8)return false;return P.y+P.h>186}

function crocUpdLunge(dt,mb){CRO.forEach(function(c){
 if(c.dead){if(c.rt>0)c.rt-=dt;else if(Math.abs(P.x-c.sx)>220){c.dead=0;c.x=c.sx;c.st=0;c.t=0;c.hp=c.hp0;c.hc=0;c.cd=80}return}
 c.t+=dt;if(c.hc>0)c.hc-=dt;if(c.cd>0)c.cd-=dt;
 if(c.st===0){c.x+=c.d*.5*dt;var mouth=c.x+c.d*30,hx=P.x+P.w/2;
  if(c.cd<=0&&crocReach(c)){var ahead=(hx-c.x)*c.d>0;if(ahead&&Math.abs(hx-mouth)<42){c.st=2;c.t=0;c.bit=0}else if(!ahead&&Math.abs(hx-c.x)>10){c.st=1;c.t=0;c.tf=c.d}}
  if(c.st===0&&((c.x>c.x1&&c.d>0)||(c.x<c.x0&&c.d<0))){c.x=Math.max(c.x0,Math.min(c.x1,c.x));c.st=1;c.t=0;c.tf=c.d}}
 else if(c.st===1){if(c.t>=26){c.d=-c.tf;c.st=0;c.t=0}}
 else if(c.st===2){var t=c.t;if(t>8&&t<30)c.x+=c.d*.8*dt;
  if(!c.bit&&t>=30){c.bit=1;var hb={x:P.x+1,y:P.y+2,w:P.w-2,h:P.h-2},bite={x:c.d>0?c.x+6:c.x-54,y:c.yb-44,w:48,h:50};
   if(crocReach(c)&&ov(hb,bite)){c.st=3;c.t=0;c.bit=0;P.caught=c;P.sv=0;P.cl=0;P.hg=0;P.mp=0;P.vx=P.vy=0;if(P.cr){P.cr=0;P.h=38}scream();return}}
  if(t>=48){c.st=0;c.t=0;c.bit=0;c.cd=110}}
 if(c.st<2){var box={x:c.x-32,y:c.yb-22,w:64,h:24};if(mb&&c.hc<=0&&ov(mb,box))crocHit(c);PR.forEach(function(p){if(p.l>0&&c.hc<=0&&!c.dead&&ov({x:p.x,y:p.y,w:7,h:3},box)){p.l=0;crocHit(c)}})}})}

   ---- end of REM ---- */
    function crocHit(c) {
        c.hp--;
        c.hc = 16;
        sfx(240, 0.12, 'square', 120);
        burst(c.x, c.yb - 10, '#6b8a3a');
        if (c.hp <= 0) {
            c.dead = 1;
            c.rt = ENEMY_RESPAWN_TICKS;
            G.score += 400;
            burst(c.x, c.yb - 10, '#4a6a2a');
            sfx(150, 0.4, 'sawtooth', 50);
        }
    }
    /* new rule: the croc only snaps when the hero TOUCHES it; one whip or machete hit kills it */
    function crocTouch(c) {
        if (P.caught || P.fall > 0 || P.inv > 0 || !G.run)
            return false;
        return ov({ x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 2 }, { x: c.x - 34, y: c.yb - 16, w: 68, h: 20 });
    }
    function crocUpd(dt, mb) {
        CRO.forEach(function (c) {
            if (c.dead) {
                if (c.rt > 0)
                    c.rt -= dt;
                else if (Math.abs(P.x - c.sx) > 220) {
                    c.dead = 0;
                    c.x = c.sx;
                    c.st = 0;
                    c.t = 0;
                    c.hp = c.hp0;
                    c.hc = 0;
                    c.cd = 80;
                }
                return;
            }
            c.t += dt;
            if (c.hc > 0)
                c.hc -= dt;
            if (c.cd > 0)
                c.cd -= dt;
            if (c.st < 2 && c.cd <= 0 && crocTouch(c)) {
                c.d = P.x + P.w / 2 >= c.x ? 1 : -1;
                c.st = 2;
                c.t = 0;
                c.bit = 0;
            }
            if (c.st === 0) {
                c.x += c.d * 0.5 * dt;
                if (c.x > c.x1 && c.d > 0 || c.x < c.x0 && c.d < 0) {
                    c.x = Math.max(c.x0, Math.min(c.x1, c.x));
                    c.st = 1;
                    c.t = 0;
                    c.tf = c.d;
                }
            } else if (c.st === 1) {
                if (c.t >= 26) {
                    c.d = -c.tf;
                    c.st = 0;
                    c.t = 0;
                }
            } else if (c.st === 2) {
                var t = c.t;
                if (t > 8 && t < 30)
                    c.x += c.d * 0.8 * dt;
                if (!c.bit && t >= 30) {
                    c.bit = 1;
                    var hb = { x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 2 };
                    if (!P.caught && P.fall <= 0 && P.inv <= 0 && G.run && ov(hb, { x: c.x - 48, y: c.yb - 48, w: 96, h: 56 })) {
                        c.st = 3;
                        c.t = 0;
                        c.bit = 0;
                        P.caught = c;
                        P.sv = 0;
                        P.cl = 0;
                        P.hg = 0;
                        P.mp = 0;
                        P.vx = P.vy = 0;
                        if (P.cr) {
                            P.cr = 0;
                            P.h = 38;
                        }
                        scream();
                        return;
                    }
                }
                if (t >= 48) {
                    c.st = 0;
                    c.t = 0;
                    c.bit = 0;
                    c.cd = 110;
                }
            }
            if (c.st < 3) {
                var box = { x: c.x - 34, y: c.yb - 34, w: 68, h: 36 };
                if (mb && c.hc <= 0 && ov(mb, box))
                    crocHit(c);
                PR.forEach(function (p) {
                    if (p.l > 0 && c.hc <= 0 && !c.dead && ov({ x: p.x, y: p.y, w: 7, h: 3 }, box)) {
                        p.l = 0;
                        crocHit(c);
                    }
                });
            }
        });
    }
    function crocCaught(dt) {
        var c = P.caught;
        if (!c)
            return;
        c.t += dt;
        P.x = c.x + c.d * 27 - 5;
        P.y = c.yb - 34;
        P.vx = 0;
        P.vy = 0;
        P.on = false;
        var q2 = Math.min(1, 0.12 * dt);
        cam += (Math.max(0, Math.min(L.W - 200, P.x + 5 - 95)) - cam) * q2;
        camY += (Math.max(-180, Math.min(100, P.y + P.h / 2 - 70)) - camY) * q2;
        if (c.t >= 118) {
            P.caught = null;
            c.st = 0;
            c.t = 0;
            c.cd = 260;
            c.x = c.c;
            c.d = -c.d;
            P.inv = 0;
            hurt(1, 1);
            if (G.run) {
                rsp();
                P.inv = 200;
            }
        }
    }
    function crocDraw() {
        CRO.forEach(function (c) {
            if (c.dead || c.x < cam - 100 || c.x > cam + 300)
                return;
            var set = CRM.sw, nm, mir = c.d < 0, yb = c.yb, t = c.t;
            if (c.st === 0)
                nm = 'cs' + (1 + ((T + c.sx) / 16 | 0) % 2);
            else if (c.st === 1) {
                nm = 'ct' + (Math.min(4, t / 26 * 5 | 0) + 1);
                mir = c.tf < 0;
            } else if (c.st === 2) {
                nm = t < 8 ? 'ca1' : t < 20 ? 'ca2' : t < 30 ? 'ca3' : 'ca4';
                yb -= 22 * Math.sin(Math.PI * Math.max(0, Math.min(1, (t - 6) / 30)));
            } else {
                set = CRM.ct;
                nm = t < 10 ? 'cc1' : t < 26 ? 'cc2' : t < 44 ? 'cc3' : t < 62 ? 'cc4' : t < 86 ? 'cc5' : 'cc6';
                if (t > 86)
                    yb += (t - 86) * 0.12;
                else if (t > 26)
                    yb -= Math.min(8, (t - 26) * 0.5);
            }
            var im = AS[nm];
            if (!im || !im.naturalWidth)
                return;
            x.save();
            if (c.hc > 0 && (c.hc | 0) % 4 < 2)
                x.globalAlpha = 0.6;
            x.translate(c.x, 0);
            if (mir)
                x.scale(-1, 1);
            x.drawImage(im, -set.ax, yb - set.by, set.w, set.h);
            x.restore();
        });
    }
    function burst(px, py, c) {
        for (var j = 0; j < 9; j++)
            PA.push({ x: px, y: py, vx: (rn() - 0.5) * 5, vy: -rn() * 4, l: 20, c: c });
    }
    function kill(e) {
        if (e.hp && --e.hp > 0) {
            sfx(300, 0.1, 'square', 150);
            return;
        }
        e.dead = 1;
        e.rt = e.k === 10 || e.k === 11 ? NEVER_RESPAWN : ENEMY_RESPAWN_TICKS;
        /* the gorilla and the woman boss never come back */
        if (e.k === 11) {
            e.ap = -1;
            if (!sampSnd(WBDIEB, 1))
                sampSnd(EDIEB, 1);
            burst(e.x + e.w / 2, e.y + e.h * 0.4, '#c8a050');
            burst(e.x + e.w / 2, e.y + e.h * 0.7, '#a02828');
        }
        if (e.k === 10) {
            burst(e.x + e.w / 2, e.y + e.h / 2, '#3a3a40');
            burst(e.x + e.w / 2, e.y + e.h * 0.7, '#7a7a82');
            sfx(70, 0.5, 'sawtooth', 30);
        }
        if (e.k === 9 || e.k === 13) {
            e.ap = -1;
            sampSnd(EDIEB, 1);
        }
        G.score += e.k === 13 ? ARC2_SCORE : e.k === 2 ? 300 : e.k === 11 ? 600 : e.k === 10 ? 400 : e.k === 9 ? 200 : e.k === 8 ? 250 : e.k === 12 ? 150 : 100;
        burst(e.x + e.w / 2, e.y + e.h / 2, e.k === 2 ? '#3f8a35' : e.k === 9 || e.k === 13 ? '#8a5a3a' : e.k === 8 ? '#e8e2c8' : e.k === 12 ? '#4a3626' : e.k ? '#5a3f80' : '#7aa81e');
        sfx(500, 0.18, 'square', 90);
    }
    function die() {
        if (!G.run)
            return;
        G.run = 0;
        if (!HDIEB)
            sfx(180, 0.5, 'sawtooth', 50);
        setTimeout(showOver, 900);
    }
    function win() {
        G.run = 0;
        G.won = 1;
        G.score += 1000;
        sfx(880, 0.4, 'square', 1760);
        setTimeout(showOver, 900);
    }
    /* whip: WH_T = ticks a whip attack lasts, WH_A0/WH_A1/WH_LAG = the arc the physics whip is guided along when she jumps / hangs (no attack frames) */
    /* ---- whip attack animation (graphics/hero_whip_attack): hero frames with the old cord removed; the hinged whip is attached at the handle end of every frame ----
   ex,ey = handle end (game units from the feet centre), ang = direction the whip leaves the handle, t = ticks the frame is shown */
    var WAF = seqImgs('graphics/hero_whip_attack/', FRAMES_HERO_WHIP_ATTACK, 'whip_attack_'), WAD = {
            w: 48.12,
            h: 53.75,
            ax: 23.93,
            seq: [
                { t: 1, ex: -21.03, ey: -44.13, ang: 108 },
                { t: 1, ex: -19.04, ey: -46.12, ang: 125 },
                { t: 1, ex: -14.4, ey: -47.78, ang: 140 },
                { t: 2, ex: -11.08, ey: -48.28, ang: 145 },
                { t: 2, ex: 11.63, ey: -50.77, ang: 218 },
                { t: 2, ex: 18.68, ey: -46.29, ang: 224 },
                { t: 2, ex: 21.83, ey: -40.9, ang: 270 },
                { t: 2, ex: 22.24, ey: -29.3, ang: 335 },
                { t: 2, ex: 23.32, ey: -27.97, ang: 342 },
                { t: 2, ex: 23.07, ey: -26.56, ang: 350 },
                { t: 4, ex: 23.07, ey: -25.65, ang: 360 }
            ]
        };
    function waActive() {
        return P.wh > 0 && P.on && !P.cr && !P.cl && !P.sw && !P.hg && !P.sv && okSet(WAF);
    }
    function waState(wh) {
        var el = Math.max(0, Math.min(WH_T - 0.000001, WH_T - wh)), k = 0, acc = 0, q = WAD.seq;
        while (k < q.length - 1 && acc + q[k].t <= el) {
            acc += q[k].t;
            k++;
        }
        return { k: k, s: k + (el - acc) / q[k].t };
    }
    function waAng(s) {
        var q = WAD.seq, n = q.length, i, f, a;
        if (s <= 0)
            a = q[0].ang;
        else if (s >= n - 1)
            a = q[n - 1].ang;
        else {
            i = Math.floor(s);
            f = s - i;
            a = q[i].ang + (q[i + 1].ang - q[i].ang) * f;
        }
        return a * Math.PI / 180;
    }
    /* ---- PHYSICS WHIP: a rope of WP_N points (verlet) in world coordinates. The first WP_HD points are the HANDLE: they are fixed to the hand and always point the way the arm holds the whip.
   All the other points are free: gravity pulls them down, they keep their length, bend a little (stiffness) and lie on the floor / ground blocks. While the swing runs they are
   pulled softly towards the old arc (WP_DRV) so the whip still reaches and cracks; when the swing is over the pull stops and the whip falls down to the floor and fades out (WP_FADE).
   WP_N points, WP_ST length of one link, WP_G gravity, WP_DAMP air drag (1 = none), WP_BEND stiffness, WP_W1/WP_W2 thickness at handle/tip ---- */
    var WP = { p: [], o: [], live: 0, fade: 0, lt: 0, reach: 0, rx: 0, ry: 0, ra: 0, tipv: 0, hist: [] };
    function waChain2(sq) {
        var pts = [{ x: 0, y: 0 }], i, a, px = 0, py = 0;
        for (i = 0; i < WP_N; i++) {
            a = waAng(sq - WA_LAG * (i + 1) / WP_N) + 0.14 * Math.sin(i * 0.55 * 17 / WP_N - sq * 1.3) * (i / WP_N);
            px += Math.cos(a) * WP_ST;
            py += Math.sin(a) * WP_ST;
            pts.push({ x: px, y: py });
        }
        return pts;
    }
    function whipChain2(q) {
        var pts = [{ x: 0, y: 0 }], i, u, e, a, px = 0, py = 0, qq = q * (1 + WH_LAG);
        for (i = 0; i < WP_N; i++) {
            u = Math.max(0, Math.min(1, qq - WH_LAG * i / WP_N));
            e = u * u * (3 - 2 * u);
            a = WH_A0 + e * (WH_A1 - WH_A0) + 0.2 * Math.sin(i * 0.45 * 17 / WP_N - q * 9) * (i / WP_N) * (1 - q);
            px += Math.cos(a) * WP_ST;
            py += Math.sin(a) * WP_ST;
            pts.push({ x: px, y: py });
        }
        return pts;
    }
    function wpInside(px, py) {
        return sol({ x: px - 0.4, y: py - 0.4, w: 0.8, h: 0.8 });
    }
    function wpStep(ax, ay, F, ang, ideal, drv) {
        var p = WP.p, o = WP.o, n = WP_N, i, k, dx, dy, l, df, vx, vy, tx, ty, ex, ey, dX = F * Math.cos(ang), dY = Math.sin(ang);
        for (i = 0; i < n; i++) {
            if (i < WP_HD) {
                p[i].x = ax + dX * WP_ST * i;
                p[i].y = ay + dY * WP_ST * i;
                o[i].x = p[i].x;
                o[i].y = p[i].y;
                continue;
            }
            vx = (p[i].x - o[i].x) * WP_DAMP;
            vy = (p[i].y - o[i].y) * WP_DAMP;
            o[i].x = p[i].x;
            o[i].y = p[i].y;
            p[i].x += vx;
            p[i].y += vy + WP_G;
            if (drv > 0 && ideal) {
                ex = ax + F * ideal[i].x;
                ey = ay + ideal[i].y;
                k = drv * (1 - 0.5 * i / n);
                p[i].x += (ex - p[i].x) * k;
                p[i].y += (ey - p[i].y) * k;
            }
            /* bending stiffness: a link tries to continue the direction of the link before it */
            dx = p[i - 1].x - p[i - 2].x;
            dy = p[i - 1].y - p[i - 2].y;
            l = Math.sqrt(dx * dx + dy * dy) || 1;
            tx = p[i - 1].x + dx / l * WP_ST;
            ty = p[i - 1].y + dy / l * WP_ST;
            k = WP_BEND * (drv > 0 ? 1 : 0.12) * (1 - (i - WP_HD) / (n - WP_HD));
            p[i].x += (tx - p[i].x) * k;
            p[i].y += (ty - p[i].y) * k;
        }
        for (k = 0; k < 5; k++)
            for (i = WP_HD; i < n; i++) {
                dx = p[i].x - p[i - 1].x;
                dy = p[i].y - p[i - 1].y;
                l = Math.sqrt(dx * dx + dy * dy) || 0.001;
                df = (l - WP_ST) / l;
                if (i - 1 < WP_HD) {
                    p[i].x -= dx * df;
                    p[i].y -= dy * df;
                } else {
                    p[i - 1].x += dx * df * 0.5;
                    p[i - 1].y += dy * df * 0.5;
                    p[i].x -= dx * df * 0.5;
                    p[i].y -= dy * df * 0.5;
                }
            }
        for (i = WP_HD; i < n; i++)
            if (wpInside(p[i].x, p[i].y)) {
                for (k = 0; k < 9 && wpInside(p[i].x, p[i].y); k++)
                    p[i].y -= 1;
                o[i].x = p[i].x;
                o[i].y = p[i].y;
            }
        /* the floor stops the whip */
        WP.tipv = Math.abs(p[n - 1].x - o[n - 1].x) + Math.abs(p[n - 1].y - o[n - 1].y);
    }
    function wpReset(ax, ay, F, ang) {
        var i;
        WP.p = [];
        WP.o = [];
        for (i = 0; i < WP_N; i++) {
            WP.p.push({ x: ax + F * Math.cos(ang) * WP_ST * i, y: ay + Math.sin(ang) * WP_ST * i });
            WP.o.push({ x: WP.p[i].x, y: WP.p[i].y });
        }
        WP.live = 1;
        WP.lt = performance.now();
        WP.hist = [];
    }
    function wpRun(ax, ay, F, ang, ideal, drv) {
        var now = performance.now(), st = Math.max(1, Math.min(4, Math.round((now - WP.lt) / 16.67)));
        WP.lt = now;
        while (st-- > 0)
            wpStep(ax, ay, F, ang, ideal, drv);
    }
    function wpPaint(mx, F, alpha) {
        var n = WP_N, i, a, b, w, lp = [], tip = WP.tipv > 2.2;
        for (i = 0; i < n; i++)
            lp.push({ x: mx + (WP.p[i].x - mx) * F, y: WP.p[i].y });
        x.save();
        x.lineCap = 'round';
        x.lineJoin = 'round';
        if (WP.tipv > 1.4) {
            for (i = 2; i >= 1; i--) {
                var h = WP.hist[WP.hist.length - i * 2];
                if (!h)
                    continue;
                x.globalAlpha = alpha * 0.13;
                x.strokeStyle = '#fff';
                x.lineWidth = 1.1;
                x.beginPath();
                for (a = WP_HD; a < n; a++) {
                    if (a === WP_HD)
                        x.moveTo(mx + (h[a].x - mx) * F, h[a].y);
                    else
                        x.lineTo(mx + (h[a].x - mx) * F, h[a].y);
                }
                x.stroke();
            }
        }
        x.globalAlpha = alpha;
        for (i = 0; i < n - 1; i++) {
            a = lp[i];
            b = lp[i + 1];
            w = i < WP_HD ? WP_W1 + 0.8 : WP_W1 + (WP_W2 - WP_W1) * ((i - WP_HD) / (n - WP_HD));
            x.strokeStyle = '#2c1a0c';
            x.lineWidth = w + 0.6;
            x.beginPath();
            x.moveTo(a.x, a.y);
            x.lineTo(b.x, b.y);
            x.stroke();
            x.strokeStyle = i < WP_HD ? '#4a2c14' : tip && i > n - 6 ? '#f4e6c8' : i % 2 ? '#a06a3a' : '#8f5c30';
            x.lineWidth = w;
            x.beginPath();
            x.moveTo(a.x, a.y);
            x.lineTo(b.x, b.y);
            x.stroke();
        }
        x.restore();
        WP.hist.push(WP.p.map(function (q) {
            return { x: q.x, y: q.y };
        }));
        if (WP.hist.length > 8)
            WP.hist.shift();
    }
    function wpReach(mx, F) {
        var r = 11, i;
        for (i = 0; i < WP.p.length; i++) {
            var d = F * (WP.p[i].x - mx);
            if (d > r)
                r = d;
        }
        return r;
    }
    function atk() {
        if (!G.run || G.pause || P.cd > 0 || P.cl || P.hg || P.sv)
            return;
        var w = P.wp;
        if (w === 0) {
            P.cd = WHIP_COOLDOWN;
            P.wh = WH_T;
            whip();
        } else if (w === 1 && P.hasM) {
            P.cd = MACE_COOLDOWN;
            P.mh = 10;
            sfx(700, 0.08, 'square', 300);
        } else if (w === 2 && P.ammo > 0) {
            P.ammo--;
            P.cd = KNIFE_COOLDOWN;
            PR.push({ x: P.x + (P.face > 0 ? 12 : -6), y: P.y + (P.cr ? 6 : 14), vx: P.face * KNIFE_SPEED, l: KNIFE_LIFE });
            sfx(1000, 0.08, 'square', 500);
        }
    }
    function pick(n) {
        sfx(1200, 0.12, 'square', 1800);
        if (n === 'gemG') {
            G.score += 100;
            G.gems++;
        } else if (n === 'gemB') {
            G.score += 250;
            G.gems++;
        } else if (n === 'heart')
            P.hp = Math.min(5, P.hp + 1);
        else if (n === 'kit')
            P.hp = Math.min(5, P.hp + 3);
        else if (n === 'knife') {
            P.ammo += 3;
            G.msg = 'THROWING KNIVES +3  (KEY 3)';
            G.mt = 120;
        } else if (n === 'mach') {
            P.hasM = 1;
            P.wp = 1;
            G.msg = 'MACHETE FOUND  (KEY 2)';
            G.mt = 140;
        }
    }
    function loop(now) {
        var dt = Math.min(2.5, (now - last) / 16.67);
        last = now;
        if (G.pause) {
            if (!G.pd) {
                G.pd = 1;
                pauseDraw();
            }
            if (G.run)
                raf = requestAnimationFrame(loop);
            return;
        }
        if (G.run)
            upd(dt);
        try {
            draw();
            fadeDraw();
            sbUpdate();
        } catch (e) {
            console.error(e);
        }
        if (G.run)
            raf = requestAnimationFrame(loop);
    }
    function upd(dt) {
        var dir = (K.r ? 1 : 0) - (K.l ? 1 : 0), dk = K.d || K.d2, mb = null, wc, spd;
        T += dt;
        if (G.fi > 0)
            G.fi -= dt;
        MP.forEach(function (m) {
            var ny = (m.t + m.b) / 2 + (m.b - m.t) / 2 * Math.sin(T * 0.012 + m.ph);
            m.dy = ny - m.y;
            m.y = ny;
        });
        ['cd', 'inv', 'wh', 'mh', 'jb', 'ct'].forEach(function (q) {
            if (P[q] > 0)
                P[q] -= dt;
        });
        if (G.mt > 0)
            G.mt -= dt;
        if (P.caught) {
            crocCaught(dt);
            return;
        }
        if (G.dp && !G.dn && P.on && !P.sw && !P.cl && !P.sv && !P.hg && okSet(DANCEF))
            danceStart();
        /* cheat key 9 waits until she stands on the ground */
        if (G.dn) {
            var dl = Math.floor(G.dn.t / (FRAMES_HERO_DANCE * DANCE_TPF));
            G.dn.t += dt;
            if (dl !== G.dn.lp && dl < DANCE_LOOPS) {
                G.dn.lp = dl;
                danceSnd();
            }
            P.vx = 0;
            P.vy = 0;
            P.inv = 0;
            if (G.dn.t >= FRAMES_HERO_DANCE * DANCE_TPF * DANCE_LOOPS) {
                if (G.pwin) {
                    G.dn = null;
                    G.dp = 0;
                    win();
                } else
                    danceEnd(BS && BS.dead ? 'GO TO THE PRINCESS' : '');
            }
            return;
        }
        if (P.er > 0) {
            P.er -= dt;
            P.vx = P.vy = 0;
            if (P.er <= 0) {
                P.er = 0;
                if (G.run)
                    rsp();
            }
            return;
        }
        /* fading out after an enemy hit, then rsp() */
        if (P.fall > 0) {
            P.fall -= dt;
            P.vy = Math.min(HERO_MAX_FALL_SPEED, P.vy + HERO_GRAVITY * JUMP_SLOW * JUMP_SLOW * dt);
            P.y += P.vy * dt;
            camY += (Math.max(-180, Math.min(100, P.y + P.h / 2 - 70)) - camY) * Math.min(1, 0.12 * dt);
            if (P.fall <= 0) {
                P.fall = 0;
                if (P.nh)
                    P.nh = 0;
                else
                    hurt(1, 1);
                if (G.run)
                    rsp();
            }
            return;
        }
        if (P.sc > 0)
            P.sc -= dt;
        if (G.run && P.on && !P.cr && !P.sw && !P.cl && !P.sv && !P.hg && !P.mp) {
            P.ls = { x: P.x, y: P.y };
            if (T - (P.lt || 0) >= 4) {
                P.lt = T;
                (P.lh = P.lh || []).push({ x: P.x, y: P.y });
                if (P.lh.length > 150)
                    P.lh.shift();
            }
        }
        /* remember where she last stood safely */
        if (P.vj) {
            P.vjt += dt;
            if (P.sv || P.cl || P.sw || P.hg)
                P.vj = 0;
            else if (P.on) {
                P.vj = 0;
                if (VL_ON && !P.cr) {
                    P.ct = CD_UP + (dir ? 0 : VL_HOLD);
                    P.cdn = -1;
                    P.cst = dir ? 0 : 1;
                }
            }
        }
        /* landed after a vine leap: crouch hold, then stand up */
        SW.forEach(function (s) {
            if (P.sv !== s)
                s.th = 0.22 * Math.sin(T / 34 + s.ph);
        });
        if (P.sv) {
            var s0 = P.sv, L2 = s0.hl || s0.len;
            var sd = dt * 2;
            s0.om += (-(VINE_G / L2) * Math.sin(s0.th) + dir * 0.0013) * sd;
            s0.om *= 1 - 0.0015 * sd;
            s0.th = Math.max(-1.35, Math.min(1.35, s0.th + s0.om * sd));
            P.x = s0.x + L2 * Math.sin(s0.th) - 5;
            P.y = s0.y + L2 * Math.cos(s0.th) - 8;
            P.vx = 0;
            P.vy = 0;
            P.on = 0;
            if (dir)
                P.face = dir;
            if (K.jp) {
                K.jp = 0;
                P.vx = Math.max(-4.25, Math.min(4.25, L2 * s0.om * 2 * Math.cos(s0.th) * 0.58 * VINE_LAUNCH));
                P.vy = Math.max(-2.6, Math.min(3, -L2 * s0.om * 2 * Math.sin(s0.th) * 0.5 * VINE_LAUNCH - 1.1));
                P.sv = 0;
                P.sc = 25;
                P.vj = 1;
                P.vjt = 0;
                sfx(300, 0.18, 'square', 700);
            }
        } else if (!P.cl && !P.sw && !P.on && P.sc <= 0)
            SW.forEach(function (s) {
                if (P.sv)
                    return;
                var dx = P.x + 5 - s.x, dy = P.y + 8 - s.y, ux = Math.sin(s.th), uy = Math.cos(s.th), tt = dx * ux + dy * uy, px = dx - tt * ux, py = dy - tt * uy;
                if (tt > 14 && tt < s.len + 8 && Math.hypot(px, py) < 12) {
                    s.hl = Math.max(22, Math.min(s.len, tt));
                    P.sv = s;
                    s.om = (P.vx * Math.cos(s.th) - P.vy * Math.sin(s.th)) / s.hl * 0.45;
                    sfx(600, 0.1, 'square', 900);
                }
            });
        if (P.hg) {
            var hh = P.hg, cxh, tt, ty;
            if (P.hgT > 0)
                P.hgT -= dt;
            P.x += dir * HERO_ROPE_SPEED * HERO_SLOW * dt;
            if (dir)
                P.face = dir;
            P.ph += Math.abs(dir) * 0.22 * HERO_SLOW * dt;
            if (P.rfh !== hh) {
                P.rfh = hh;
                P.rf = 0;
            }
            if (dir || !ROPE_SAFE(P.rf))
                P.rf = ((P.rf || 0) + ROPE_FPT * dt) % FRAMES_HERO_ROPE_HANG;
            /* frames advance while she moves; when she stops she finishes the step and holds a pose with both hands on the rope */
            P.vx = 0;
            P.vy = 0;
            P.on = 0;
            cxh = P.x + 5;
            tt = Math.max(0, Math.min(1, (cxh - hh.x0) / (hh.x1 - hh.x0)));
            ty = hh.ry + 40 * tt * (1 - tt) - 4;
            P.y += (ty - P.y) * Math.min(1, 0.25 * dt);
            if (K.jp) {
                K.jp = 0;
                P.hg = 0;
                P.vy = 1;
                P.sc = 20;
            } else if (dir > 0 && cxh >= hh.x1 + 4) {
                P.hg = 0;
                P.x = hh.x1 + 3;
                P.y = hh.yG - P.h;
                P.vy = -HERO_ROPE_HOP_UP * JUMP_SLOW;
                P.vx = HERO_ROPE_HOP_SIDE;
                P.face = 1;
                P.on = 0;
                sfx(500, 0.15, 'square', 900);
            } else if (dir < 0 && cxh <= hh.x0 - 4) {
                P.hg = 0;
                P.x = hh.x0 - 13;
                P.y = hh.yG - P.h;
                P.vy = -HERO_ROPE_HOP_UP * JUMP_SLOW;
                P.vx = -HERO_ROPE_HOP_SIDE;
                P.face = -1;
                P.on = 0;
                sfx(500, 0.15, 'square', 900);
            }
        } else if (P.cr && P.on && !P.sv && !P.cl)
            HL.forEach(function (h) {
                var c = P.x + 5;
                if (!P.hg && (P.face > 0 && c >= h.x0 - 12 && c <= h.x0 + 2 || P.face < 0 && c <= h.x1 + 12 && c >= h.x1 - 2)) {
                    P.hg = h;
                    P.cr = 0;
                    P.h = 38;
                    P.y = h.yG - P.h;
                    P.x = (P.face > 0 ? h.x0 : h.x1) - 5;
                    P.on = 0;
                    P.vy = 0;
                    P.vx = 0;
                    P.hgT = 14;
                    sfx(400, 0.12, 'square', 300);
                }
            });
        if (!P.sv && !P.hg) {
            if (dk && !P.cl && !P.sw && P.on && !P.cr) {
                P.cr = 1;
                P.y += 16;
                P.h = 22;
                P.ct = CD_DN;
                P.cdn = 1;
                P.cst = Math.abs(P.vx) > 0.3 ? 0 : 1;
            } else if (P.cr && !(dk && P.on) && !sol({ x: P.x, y: P.y + P.h - 38, w: P.w, h: 38 })) {
                P.cr = 0;
                P.y -= 16;
                P.h = 38;
                P.ct = CD_UP;
                P.cdn = -1;
                P.cst = Math.abs(P.vx) > 0.3 ? 0 : 1;
            }
            if (!P.cl && !P.sw)
                L.v.forEach(function (v) {
                    if (!P.cl && Math.abs(P.x + 5 - v[0]) < 8 && P.y + P.h > v[1] + 2 && P.y < v[2] && (K.u || K.d && P.on && Math.abs(P.y + P.h - v[1]) < 5)) {
                        P.cl = v;
                        P.x = v[0] - 5;
                        P.vy = 0;
                        P.on = 0;
                        if (P.cr) {
                            P.cr = 0;
                            P.y -= 16;
                            P.h = 38;
                        }
                        if (K.d && !K.u)
                            P.y += 3;
                    }
                });
            if (P.on)
                P.co = 6;
            else if (P.co > 0)
                P.co -= dt;
            if (K.jp) {
                K.jp = 0;
                P.jb = 8;
            }
            if (K.sj) {
                K.sj = 0;
                if (P.cl) {
                    P.cl = 0;
                    P.vy = -HERO_CLIMB_JUMP_SPEED * JUMP_SLOW;
                    P.jb = 0;
                    sfx(300, 0.18, 'square', 700);
                }
            }
            if (P.jb > 0 && !P.sw && !P.cl && P.co > 0 && !P.cr) {
                P.vy = -HERO_JUMP_SPEED * JUMP_SLOW;
                P.on = 0;
                P.co = 0;
                P.jb = 0;
                sfx(300, 0.18, 'square', 700);
            }
            if (P.sw && P.shal && P.jb > 0 && !P.cl && P.y + P.h <= P.shal[2] + 18) {
                P.jb = 0;
                P.vy = -HERO_JUMP_SPEED * JUMP_SLOW;
                P.nsw = 16;
                P.sw = 0;
                P.on = 0;
                sfx(300, 0.18, 'square', 700);
            }
            spd = P.sw ? HERO_SWIM_SPEED * HERO_SLOW : P.cr ? HERO_CROUCH_SPEED * HERO_SLOW : HERO_WALK_SPEED;
            if (P.cl) {
                var v = P.cl, dy = ((K.d ? 1 : 0) - (K.u ? 1 : 0)) * HERO_CLIMB_SPEED * HERO_SLOW * dt;
                P.vx = 0;
                P.vy = 0;
                P.y += dy;
                P.ph += Math.abs(dy) * 0.3;
                if (dy) {
                    P.cf = (P.cf || 0) - Math.sign(dy) * CLIMB_FPT * dt;
                    if (P.cf < 0)
                        P.cf += CLIMBF.length;
                    P.cf %= CLIMBF.length;
                }
                if (P.y + P.h > v[2] + 2)
                    P.cl = 0;
                else if (P.y + P.h <= v[1]) {
                    P.cl = 0;
                    P.vy = -HERO_CLIMB_TOP_HOP * JUMP_SLOW;
                    P.x += v[3] * 6;
                }
            } else {
                P.vx = dir * spd * (P.on || P.sw ? 1 : HERO_AIR_SPEED_FACTOR * JUMP_SLOW);
                if (dir)
                    P.face = dir;
                if (P.sw) {
                    P.vy += (SWIM_SINK + (K.d ? SWIM_DIVE : 0) - (K.u || K.j ? SWIM_RISE : 0)) * dt;
                    P.vy = Math.max(-SWIM_MAX_UP * HERO_SLOW, Math.min(SWIM_MAX_DOWN * HERO_SLOW, P.vy));
                } else
                    P.vy = Math.min(HERO_MAX_FALL_SPEED, P.vy + HERO_GRAVITY * JUMP_SLOW * JUMP_SLOW * dt);
                if ((P.on || P.sw) && dir)
                    P.ph += spd * dt * 0.28 * (P.on && !P.cr && !P.sw ? RUN_ANIM_K : 1);
                P.x += P.vx * dt;
                L.s.forEach(function (s) {
                    if ((s[4] === 'g' || s[4] === 'r') && ov(P, { x: s[0], y: s[1], w: s[2], h: s[3] })) {
                        if (P.vx > 0)
                            P.x = s[0] - P.w;
                        else if (P.vx < 0)
                            P.x = s[0] + s[2];
                    }
                });
                P.x = Math.max(0, Math.min(L.W - P.w, P.x));
                if (P.on && P.mp)
                    P.y += P.mp.dy;
                var py = P.y;
                P.y += P.vy * dt;
                P.on = 0;
                P.mp = 0;
                L.s.forEach(function (s) {
                    var t = s[4], r = { x: s[0], y: s[1], w: s[2], h: s[3] };
                    if (t === 'g' || t === 'r') {
                        if (ov(P, r)) {
                            if (P.vy >= 0) {
                                P.y = r.y - P.h;
                                P.vy = 0;
                                P.on = 1;
                            } else {
                                P.y = r.y + r.h;
                                P.vy = 0;
                            }
                        }
                    } else if (P.vy >= 0 && P.x + P.w > r.x && P.x < r.x + r.w && py + P.h <= r.y + 1 && P.y + P.h >= r.y) {
                        P.y = r.y - P.h;
                        P.vy = 0;
                        P.on = 1;
                    }
                });
                MP.forEach(function (m) {
                    if (P.vy >= 0 && P.x + P.w > m.x && P.x < m.x + m.w && py + P.h <= m.y + 1 && P.y + P.h >= m.y) {
                        P.y = m.y - P.h;
                        P.vy = 0;
                        P.on = 1;
                        P.mp = m;
                    }
                });
            }
        }
        wc = P.x + 5;
        P.sw = 0;
        if (L.ms)
            L.ms.forEach(function (q) {
                if (!q.d && wc >= q[0]) {
                    q.d = 1;
                    G.msg = q[1];
                    G.mt = 170;
                }
            });
        var inw = 0;
        P.shal = 0;
        if (P.nsw > 0)
            P.nsw -= dt;
        L.w.forEach(function (z) {
            if (wc > z[0] && wc < z[0] + z[1] && P.y + P.h > z[2] + 4 && !(P.nsw > 0)) {
                P.sw = 1;
                if (!z[3]) {
                    inw = 1;
                    P.shal = z;
                }
            }
        });
        if (P.shal && P.y + P.h > 238) {
            P.y = 238 - P.h;
            P.vy = 0;
        }
        if (inw) {
            if (P.wt <= 0)
                sfx(250, 0.2, 'sawtooth', 90);
            P.wt += dt;
            if (P.wt >= HERO_WATER_TICKS) {
                P.wt = 0;
                wet();
            }
        } else if (P.on || P.cl || P.sv || P.hg)
            P.wt = 0;
        else
            P.wt = Math.max(0, P.wt - dt * 0.1);
        if (P.y > 270)
            wet();
        L.sk.forEach(function (s) {
            if (ov(P, { x: s[0], y: 178, w: s[1], h: 12 })) {
                hurt(1, 1);
                P.vy = -HERO_SPIKE_BOUNCE * JUMP_SLOW;
            }
        });
        spikesHit();
        if (P.wh > 0) {
            var wl = WP.live && WP.reach ? WP.reach + 5 : 16;
            mb = P.face > 0 ? { x: P.x + P.w, y: P.y + 4, w: wl, h: P.h - 4 } : { x: P.x - wl, y: P.y + 4, w: wl, h: P.h - 4 };
        } else if (P.mh > 0)
            mb = P.face > 0 ? { x: P.x + P.w, y: P.y + 2, w: 26, h: P.h - 6 } : { x: P.x - 26, y: P.y + 2, w: 26, h: P.h - 6 };
        EN.forEach(function (e) {
            if (e.dead) {
                if (e.rt > 0)
                    e.rt -= dt;
                else if (Math.abs(P.x - e.sx) > 220) {
                    e.dead = 0;
                    e.x = e.sx;
                    e.y = e.sy;
                    e.hp = e.hp0;
                    e.hc = 0;
                    e.d = -1;
                    e.at = 0;
                    e.ac = 0;
                    e.ap = -1;
                    e.ac2 = 0;
                    e.ia = 0;
                    e.il = 0;
                    e.gs = 0;
                    e.cd = 0;
                    e.gt = 0;
                    e.wk = 0;
                    e.it = 0;
                    e.gy = e.sy + e.h;
                    e.cs = 0;
                    e.cc = 60;
                }
                return;
            }
            e.t += dt;
            if (e.hc > 0)
                e.hc -= dt;
            if (e.k === 9)
                archerUpd(e, dt);
            if (e.k === 13)
                archer2Upd(e, dt);
            if (e.k === 10)
                gorUpd(e, dt);
            if (e.k === 11)
                wbUpd(e, dt);
            if (e.k === 12)
                chimpUpd(e, dt);
            if (ATK_ON) {
                if (e.at > 0) {
                    e.at -= dt;
                    if (e.k === 8 && !e.sn && e.at > 0 && (1 - e.at / SK_ATK_T) * FRAMES_SKELETON_ATTACK >= SK_SND_FRAME - 1) {
                        e.sn = 1;
                        if (e.x > cam - 30 && e.x < cam + 230)
                            sampSnd(SKAB, 1);
                    }
                } else {
                    if (e.ac > 0)
                        e.ac -= dt;
                    if (!(e.ac > 0) && !P.caught && Math.abs(P.x - e.x) < ATK_RX[e.k] && Math.abs(P.y + P.h / 2 - (e.y + e.h / 2)) < ATK_RY && Math.abs(e.x - P.x) > 0) {
                        e.at = atkLen(e);
                        e.sn = 0;
                        e.ac = ATK_CD;
                        if (P.x > e.x ? e.x < e.b : e.x > e.a)
                            e.d = P.x > e.x ? 1 : -1;
                    }
                }
            }
            if (!(e.at > 0))
                e.x += e.d * SPD[e.k] * dt;
            if (e.k !== 10 && e.k !== 12) {
                if (e.x < e.a)
                    e.d = 1;
                if (e.x > e.b)
                    e.d = -1;
            }
            if (e.k === 1)
                e.y = e.y0 + Math.sin(e.t / BAT_BOB_PERIOD) * BAT_BOB_HEIGHT;
            else if (e.k === 6)
                e.y = e.y0 + Math.sin(e.t / DRAGONFLY_BOB_PERIOD) * DRAGONFLY_BOB_HEIGHT;
            if (e.at > 0 && (e.k === 1 || e.k === 6))
                e.y += Math.sin(Math.PI * (1 - e.at / ATK_T)) * 8;
            if (mb && ov(mb, e)) {
                if (!(e.hc > 0)) {
                    e.hc = 18;
                    kill(e);
                }
            } else if (ov({ x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 2 }, { x: e.x + 3, y: e.y + 2, w: e.w - 6, h: e.h - 2 }))
                hurt(1);
            else if (SK_HIT && e.k === 8 && e.at > 0 && skSword(e))
                hurt(1);
        });
        PR.forEach(function (p) {
            p.x += p.vx * dt;
            p.l -= dt;
            var b = { x: p.x, y: p.y, w: 7, h: 3 };
            if (sol(b))
                p.l = 0;
            EN.forEach(function (e) {
                if (!e.dead && p.l > 0 && ov(b, e)) {
                    kill(e);
                    p.l = 0;
                }
            });
        });
        PR = PR.filter(function (p) {
            return p.l > 0;
        });
        PA.forEach(function (p) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 0.3 * dt;
            p.l -= dt;
        });
        PA = PA.filter(function (p) {
            return p.l > 0;
        });
        crocUpd(dt, mb);
        bossUpd(dt, mb);
        arrowUpd(dt, mb);
        coconutUpd(dt, mb);
        IT.forEach(function (t) {
            if (t.n === 'gemR') {
                /* red danger gem: hurts, never disappears */
                if (G.run && ov(P, { x: t.x - RED_GEM_HIT, y: t.y - RED_GEM_HIT, w: RED_GEM_HIT * 2, h: RED_GEM_HIT * 2 }))
                    hurt(RED_GEM_DAMAGE, 1);
                return;
            }
            if (!t.got && ov(P, { x: t.x - 8, y: t.y - 8, w: 16, h: 16 })) {
                t.got = 1;
                pick(t.n);
            }
        });
        while (P.cp + 1 < L.c.length && P.x > L.c[P.cp + 1])
            P.cp++;
        if (wc >= L.g && (!BS || BS.dead)) {
            if (LI < LV.length - 1) {
                LI++;
                G.score += 500;
                loadLevel();
                G.msg = 'PRINCESS RESCUED!  ' + L.n;
                G.mt = 220;
            } else {
                if (PR_ON && okSet(PRF) && okSet(DANCEF)) {
                    if (!G.pwin && P.on)
                        princessDance();
                } else
                    win();
            }
        }
        var q2 = Math.min(1, 0.12 * dt);
        cam += (Math.max(0, Math.min(L.W - 200, wc - 95 + bossCamOff())) - cam) * q2;
        camY += (Math.max(-180, Math.min(100, P.y + P.h / 2 - 70)) - camY) * q2;
    }
    var LKP = ['6,46,100', '10,62,122', '22,116,170', '40,170,196', '150,232,244', '40,170,196', '22,116,170', '10,62,122'];
    /* lake colour cycle */
    var WPAL = ['10,70,135', '14,92,155', '22,124,180', '40,160,204', '90,200,230', '170,235,248', '90,200,230', '40,160,204', '22,124,180', '14,92,155'];
    /* water colour cycle */
    function water(z, a) {
        x.fillStyle = 'rgba(18,105,150,' + a + ')';
        x.fillRect(z[0], z[2], z[1], H - z[2]);
        var cx0 = Math.max(z[0], cam - 6), cx1 = Math.min(z[0] + z[1], cam + 290), ck, cy, cn = WPAL.length, cs = T * 0.14 | 0;
        if (cx1 > cx0) {
            cycWater(cx0, z[2], cx1 - cx0, H - z[2], a > 0.5 ? 0.85 : 0.7);
            x.save();
            x.beginPath();
            x.rect(cx0, z[2], cx1 - cx0, H - z[2]);
            x.clip();
            for (cy = z[2] + 2, ck = 0; cy < H; cy += 3.4, ck++) {
                x.fillStyle = 'rgba(' + WPAL[(ck + cs) % cn] + ',' + (a > 0.5 ? 0.5 : 0.3) + ')';
                x.fillRect(cx0, cy, cx1 - cx0, 2.1);
            }
            x.restore();
        }
        x.fillStyle = 'rgba(150,235,255,.6)';
        for (var i = Math.max(0, Math.floor((cam - 10 - z[0]) / 7) * 7), ie = Math.min(z[1], cam + 300 - z[0]); i < ie; i += 7)
            x.fillRect(z[0] + i, z[2] + Math.sin((T + i) / 7) * 1.3, 4, 1.5);
    }
    function solid(s) {
        var t = s[4], X = s[0], Y = s[1], w = s[2], h = s[3];
        if (X > cam + 280 || X + w < cam - 10)
            return;
        if (t === 'g' || t === 'r') {
            if (!s._c && w * (h + 10) * 16 < 6000000 && AS.tA && AS.tA.naturalWidth && AS.tB && AS.tB.naturalWidth && AS.tC && AS.tC.naturalWidth && AS.tD && AS.tD.naturalWidth && AS.tR && AS.tR.naturalWidth) {
                var sc0 = document.createElement('canvas'), ox = x;
                sc0.width = Math.ceil(w * 4);
                sc0.height = Math.ceil((h + 10) * 4);
                x = sc0.getContext('2d');
                x.imageSmoothingEnabled = true;
                x.setTransform(4, 0, 0, 4, -X * 4, -(Y - 10) * 4);
                x.save();
                x.beginPath();
                x.rect(X, Y - 10, w, h + 10);
                x.clip();
                for (var tx0 = X - 4, n0 = 0; tx0 < X + w; tx0 += 34, n0++) {
                    sp(['tA', 'tB', 'tC', 'tD'][n0 % 4], tx0, Y - 3, 42, 42);
                    for (var ty0 = Y + 34; ty0 < Y + h; ty0 += 34)
                        sp('tR', tx0, ty0, 42, 42);
                }
                x.restore();
                x.fillStyle = 'rgba(12,22,6,.55)';
                x.fillRect(X, Y - 1, w, 1.6);
                x = ox;
                s._c = sc0;
            }
            if (s._c) {
                x.drawImage(s._c, X, Y - 10, w, h + 10);
                return;
            }
            x.save();
            x.beginPath();
            x.rect(X, Y - 10, w, h + 10);
            x.clip();
            for (var tx = X - 4, n = 0; tx < X + w; tx += 34, n++) {
                sp(['tA', 'tB', 'tC', 'tD'][n % 4], tx, Y - 3, 42, 42);
                for (var ty = Y + 34; ty < Y + h; ty += 34)
                    sp('tR', tx, ty, 42, 42);
            }
            x.restore();
            x.fillStyle = 'rgba(12,22,6,.55)';
            x.fillRect(X, Y - 1, w, 1.6);
        } else if (t === 'm')
            sp('moss', X, Y - 8, w, 16);
        else if (t === 'l')
            sp('log', X, Y - 8, w, 16);
        else if (t === 'p') {
        }
    }
    function bridgeDraw(s) {
        var X = s[0], Y = s[1], w = s[2], iB = AS.bridge;
        if (s[4] !== 'b' || X > cam + 280 || X + w < cam - 10)
            return;
        if (iB && iB.naturalWidth) {
            var S = Math.min(1.3, w / (2 * iB.naturalWidth / 3.2)), cw = iB.naturalWidth / 3.2 * S, hh = iB.naturalHeight / 3.2 * S, tp2 = Y - hh * BR_ANCH;
            x.drawImage(iB, X, tp2, cw, hh);
            x.drawImage(iB, X + cw - 0.3, tp2, w - 2 * cw + 0.6, hh);
            x.drawImage(iB, X + w - cw, tp2, cw, hh);
        }
    }
    /* bridges are drawn after the hero and enemies: they stand BEHIND the transparent ropes */
    var ED = [
            [22, 28], [26, 18], [40, 22], [28, 30], [18, 42], [22, 16], [28, 14], [40, 26], [20, 40], [15, 51],
            [28, 46], [16, 50], [22, 36], [15, 48]
        ], EF = [
            ['snake'], ['bat1', 'bat2'], ['steg'], ['rap1', 'rap2'], ['liz'], ['spid'], ['dfly'], ['beast'], ['skel'],
            ['skel'], ['skel'], ['skel'], ['skel'], ['skel']
        ], EFace = [1, -1, 1, 1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1], SPD = [SPEED_SNAKE, SPEED_BAT, SPEED_CROCODILE, SPEED_RAPTOR, SPEED_LIZARDMAN, SPEED_SPIDER, SPEED_DRAGONFLY, SPEED_BEAST, SPEED_SKELETON, 0, 0, 0, 0, 0];
    /* kind 8 = skeleton (5 hits, temporary graphics in graphics/enemy_anims/skeleton) */
    function enemy(e) {
        if (e.dead) {
            if (e.k === 12)
                chimpRope(e);
            return;
        }
        if (e.x > cam + 450 || e.x + (e.w || 0) < cam - 170)
            return;
        if (e.k === 12) {
            chimpDraw(e, 0);
            return;
        }
        if (e.k === 9) {
            archerDraw(e);
            return;
        }
        if (e.k === 13) {
            archer2Draw(e);
            return;
        }
        if (e.k === 10) {
            gorDraw(e);
            return;
        }
        if (e.k === 11) {
            wbDraw(e);
            return;
        }
        var nm = EF[e.k], im, fs = null, im2 = null, fr2 = 0;
        if (e.at > 0 && okSet(ENAT[e.k])) {
            fs = ENAT[e.k];
            im = fs[Math.min(fs.length - 1, Math.floor((1 - e.at / atkLen(e)) * fs.length))];
        } else if (okSet(ENMV[e.k])) {
            fs = ENMV[e.k];
            var ff = (T + e.t) / ENMT[e.k], jj = Math.floor(ff);
            im = fs[jj % fs.length];
            if (e.k === 8 && fs.length > 8) {
                im2 = fs[(jj + 1) % fs.length];
                fr2 = ff - jj;
            }
        } else
            im = AS[nm[Math.floor((T + e.t) / (e.k === 1 || e.k === 6 ? 11 : 20)) % nm.length]];
        if (!im || !im.naturalWidth)
            return;
        var sc = im.naturalWidth >= 300 ? 6.4 : 3.2, iw = im.naturalWidth / sc, ih = im.naturalHeight / sc, cx = e.x + e.w / 2, dy = e.k === 1 || e.k === 6 ? e.y + e.h / 2 - ih / 2 : e.y + e.h - ih;
        x.save();
        if (e.d * EFace[e.k] < 0) {
            x.translate(cx, 0);
            x.scale(-1, 1);
            x.translate(-cx, 0);
        }
        var hf = e.hc > 0 && (e.hc | 0) % 4 < 2 ? 0.5 : 1;
        x.globalAlpha = hf;
        x.drawImage(im, cx - iw / 2, dy, iw, ih);
        if (im2 && im2.naturalWidth && fr2 > 0.04) {
            x.globalAlpha = hf * fr2 * 0.55;
            x.drawImage(im2, cx - iw / 2, dy, im2.naturalWidth / sc, im2.naturalHeight / sc);
        }
        x.restore();
    }
    var SWM = { 'w': 38.12, 'h': 45.62, 'hx': 15.37, 'hy': 1.28 };
    var ID = { 'w': 24.38, 'h': 47.5, 'ax': 15.21 };
    /* duck pose size */
    var DK = { 'w': 41.86, 'h': 31.45, 'ax': 21.4 }, DN = { 'w': 43.33 * DUCK_K, 'h': 38.54 * DUCK_K, 'ax': 23.14 * DUCK_K, 'sk': 1.6 };
    /* ---- crouch-down animation (graphics/hero_crouch/crouch_down_01..05, from crouchdown.zip): standing/running -> crouch. Plays when Down is pressed, in reverse when released.
   frame 1 = running pose (used when moving), 2-4 = lowering, 5 = deepest; then it dissolves into crouch_2_hold. All frames face RIGHT. ---- */
    var CDF = seqImgs('graphics/hero_crouch/', FRAMES_HERO_CROUCH_DOWN, 'crouch_down_'), CDD = [
            { w: 35.21, h: 47.17, ax: 20.31, sk: 0.07 },
            { w: 37.79, h: 43.44, ax: 21.2, sk: 0.1 },
            { w: 37.48, h: 40.86, ax: 19.97, sk: 0.1 },
            { w: 42.32, h: 42.62, ax: 24.38, sk: 0.15 },
            { w: 50.68, h: 29.14, ax: 28.67, sk: 0.1 }
        ];
    /* CD_DN/CD_UP = ticks going down / standing up, CD_DZ = share of the time spent dissolving into the hold pose */
    function crouchAnim(mx, fy) {
        var u = P.cdn > 0 ? 1 - P.ct / CD_DN : P.ct / CD_UP, s = P.cst || 0, hz = 1 - CD_DZ, p, i, fr, ha, dk = AS.crouch, d, j;
        u = Math.max(0, Math.min(1, u));
        p = s + (4 - s) * Math.min(1, u / hz);
        i = Math.min(4, Math.floor(p));
        fr = p - i;
        ha = u > hz ? (u - hz) / CD_DZ : 0;
        d = CDD[i];
        x.drawImage(tb(CDF, i), mx - d.ax, fy - d.h + d.sk, d.w, d.h);
        if (i < 4 && fr > 0.08) {
            j = i + 1;
            d = CDD[j];
            x.globalAlpha = fr * 0.55;
            x.drawImage(tb(CDF, j), mx - d.ax, fy - d.h + d.sk, d.w, d.h);
            x.globalAlpha = 1;
        }
        if (ha > 0 && dk && dk.naturalWidth) {
            x.save();
            x.globalAlpha = Math.min(1, ha);
            x.drawImage(dk, mx - DK.ax, fy - DK.h + 0.3, DK.w, DK.h);
            x.restore();
        }
    }
    /* ---- victory dance (graphics/hero_dance/dance_01..90, cut out of dance1.mp4): plays DANCE_LOOPS times after the end boss is down, before the hero walks on to the princess.
   Frames are drawn as filmed (fixed anchor), 24 pictures per second = DANCE_TPF game ticks per picture. DNC: size in game units, ax = body centre, gy = ground line from the top. ---- */
    /* cheat key 5: jump in front of the first ENEMY 10 archer (x 12400). cheat key 8: jump next to the first enemy 30 archer (x 10249). All archers are brought back to life if they were already killed */
    function cheatArcher(px, nm) {
        if (G.dn)
            danceEnd('');
        if (P.cr) {
            P.cr = 0;
            P.h = 38;
        }
        P.x = px || 10152;
        P.y = 60;
        P.vx = P.vy = 0;
        P.cl = P.sv = P.hg = P.sw = 0;
        P.fall = 0;
        P.caught = 0;
        P.on = 0;
        P.ct = 0;
        P.inv = 60;
        P.face = 1;
        cam = P.x - 95;
        camY = Math.max(-180, Math.min(100, P.y + P.h / 2 - 70));
        EN.forEach(function (e) {
            if (e.k === 9 || e.k === 13) {
                e.dead = 0;
                e.x = e.sx;
                e.y = e.sy;
                e.hp = e.hp0;
                e.hc = 0;
                e.ap = -1;
                e.ac2 = 0;
                e.ia = 0;
                e.il = 0;
            }
        });
        AR = [];
        G.msg = 'CHEAT: ' + (nm || 'ARCHER');
        G.mt = 120;
    }
    /* cheat key 0: jump in front of the woman boss (right before the end boss); she is brought back to life if she was already killed */
    function cheatBoss() {
        if (G.dn)
            danceEnd('');
        if (P.cr) {
            P.cr = 0;
            P.h = 38;
        }
        G.pwin = 0;
        bossInit();
        /* a fresh end boss, also after he was beaten */
        P.x = 17812;
        P.y = 179 - P.h;
        P.vx = P.vy = 0;
        P.cl = P.sv = P.hg = P.sw = 0;
        P.fall = 0;
        P.caught = 0;
        P.on = 0;
        P.ct = 0;
        P.inv = 60;
        P.face = 1;
        cam = P.x - 95;
        camY = Math.max(-180, Math.min(100, P.y + P.h / 2 - 70));
        G.msg = 'CHEAT: END BOSS';
        G.mt = 120;
    }
    /* key 7 */
    function cheatSkel() {
        if (G.dn)
            danceEnd('');
        if (P.cr) {
            P.cr = 0;
            P.h = 38;
        }
        EN.forEach(function (e) {
            if (e.k === 11) {
                e.dead = 0;
                e.x = e.sx;
                e.y = e.sy;
                e.hp = e.hp0;
                e.hc = 0;
                e.ap = -1;
                e.ac2 = 0;
                e.ia = 0;
                e.il = 0;
            }
        });
        AR = [];
        P.x = 17352;
        P.y = 100;
        P.vx = P.vy = 0;
        P.cl = P.sv = P.hg = P.sw = 0;
        P.fall = 0;
        P.caught = 0;
        P.on = 0;
        P.ct = 0;
        P.inv = 60;
        P.face = 1;
        cam = P.x - 95;
        camY = Math.max(-180, Math.min(100, P.y + P.h / 2 - 70));
        G.msg = 'CHEAT: WOMAN BOSS';
        G.mt = 120;
    }
    function danceStart() {
        if (P.cr) {
            P.cr = 0;
            P.y -= 16;
            P.h = 38;
        }
        P.ct = 0;
        P.inv = 0;
        P.vx = 0;
        P.vy = 0;
        G.dn = { t: 0, lp: -1 };
        G.dp = 0;
        G.msg = 'VICTORY DANCE!';
        G.mt = FRAMES_HERO_DANCE * DANCE_TPF * DANCE_LOOPS;
        if (A.mg && A.ctx)
            try {
                A.mg.gain.setTargetAtTime(0.3, A.ctx.currentTime, 0.15);
            } catch (e) {
            }
    }
    function danceEnd(msg) {
        G.dn = null;
        G.dp = 0;
        P.inv = 60;
        if (msg) {
            G.msg = msg;
            G.mt = 240;
        }
        if (A.mg && A.ctx)
            try {
                A.mg.gain.setTargetAtTime(1, A.ctx.currentTime, 0.3);
            } catch (e) {
            }
    }
    /* size of the victory dance (1 = same height as the idle pose) */
    /* ---- hand-over-hand rope hang (graphics/hero_rope/rope_01..37, from rope.zip): plays while she crosses a rope hole. Frames fit the game at ROPE_K units per picture pixel; the rope itself is drawn by the game. */
    /* ---- palm-trunk climbing (graphics/hero_climb/climb_01..33, from climbloop.zip, rope removed): plays while she climbs a trunk. Up = forward, Down = backward, still = held. Trunk centre = the picture's x anchor. */
    var CLIMBF = seqImgs('graphics/hero_climb/', FRAMES_HERO_CLIMB, 'climb_');
    function climbDraw() {
        var mx = P.x + 5, fy = P.y + P.h + CLIMB_DY, N = CLIMBF.length, f = ((P.cf || 0) % N + N) % N, j0 = Math.floor(f), fr = f - j0, j1 = (j0 + 1) % N, iw = CLIMBF[0].naturalWidth * CLIMB_K, ih = CLIMBF[0].naturalHeight * CLIMB_K;
        x.save();
        x.translate(mx, fy);
        if (P.face < 0)
            x.scale(-1, 1);
        x.drawImage(CLIMBF[j0], -CLIMB_AX * CLIMB_K, -CLIMB_AY * CLIMB_K, iw, ih);
        if (fr > 0.04) {
            x.globalAlpha = fr * 0.55;
            x.drawImage(CLIMBF[j1], -CLIMB_AX * CLIMB_K, -CLIMB_AY * CLIMB_K, iw, ih);
            x.globalAlpha = 1;
        }
        x.restore();
    }
    /* ---- WATER SPIKES (graphics/level_plants_vines/spikes_water.webp): one row of spikes on the bottom of every open water (every rope hole, pool and lake gap). Touching them costs one heart. */
    var SPK_IMG = new Image(), SPKS = [];
    SPK_IMG.src = imgSrc('graphics/level_plants_vines/spikes_water.webp');
    /* SPK_K = units per picture pixel (tile = 32 units wide); SPK_HIT = height (units) of the dangerous part above the level bottom. SPKS = list of [x0,x1] water gaps, built when the level loads. */
    function spikesInit() {
        SPKS = [];
        var cov = [], m = [];
        L.s.forEach(function (q) {
            if (q[1] + q[3] >= H - 4)
                cov.push([
                    q[0],
                    q[0] + q[2]
                ]);
        });
        cov.sort(function (a, b) {
            return a[0] - b[0];
        });
        cov.forEach(function (c) {
            if (m.length && c[0] <= m[m.length - 1][1])
                m[m.length - 1][1] = Math.max(m[m.length - 1][1], c[1]);
            else
                m.push([
                    c[0],
                    c[1]
                ]);
        });
        L.w.forEach(function (z) {
            var b = z[0] + z[1], cur = z[0];
            m.forEach(function (c) {
                if (c[1] <= cur || c[0] >= b)
                    return;
                if (c[0] > cur)
                    SPKS.push([
                        cur,
                        c[0]
                    ]);
                cur = Math.max(cur, c[1]);
            });
            if (cur < b)
                SPKS.push([cur, b]);
        });
        SPKS = SPKS.filter(function (g) {
            return g[1] - g[0] >= 10;
        });
    }
    function spikesDraw() {
        if (!SPK_ON || !SPK_IMG.naturalWidth)
            return;
        var tw = SPK_IMG.naturalWidth * SPK_K, th = SPK_IMG.naturalHeight * SPK_K;
        SPKS.forEach(function (g) {
            if (g[1] < cam - 20 || g[0] > cam + 300)
                return;
            x.save();
            x.beginPath();
            x.rect(g[0], H - th, g[1] - g[0], th + 1);
            x.clip();
            for (var tx = g[0] + Math.floor((Math.max(g[0], cam - 40) - g[0]) / tw) * tw; tx < Math.min(g[1], cam + 300); tx += tw)
                x.drawImage(SPK_IMG, tx, H - th, tw + 0.4, th);
            x.restore();
        });
    }
    function spikesHit() {
        if (!SPK_ON || P.inv > 0)
            return;
        var r = { x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 2 };
        for (var i = 0; i < SPKS.length; i++) {
            var g = SPKS[i];
            if (ov(r, { x: g[0], y: H - SPK_HIT, w: g[1] - g[0], h: SPK_HIT })) {
                hurt(1, 1);
                P.vy = -2.2 * JUMP_SLOW;
                if (G.run && RESP_SAFE && !(P.fall > 0)) {
                    P.fall = FADE_OUT;
                    P.nh = 1;
                    P.vx = 0;
                    P.sv = 0;
                    P.vj = 0;
                    P.cl = 0;
                }
                /* spikes in the water = death: fade out, back on the ground */
                return;
            }
        }
    }
    /* ---- GORILLA (enemy kind 10): 6 hits, never respawns. He stays put until he is ON SCREEN, then he follows you through the WHOLE level for ever, only with
   jump attacks: crouch, jump (GOR_REACH units far, GOR_ARC high), land with his full weight (landing on / next to you = 1 heart), rest GOR_CD ticks, jump again.
   Before every jump he looks for a safe landing (ground below, no water, no wall, not too high) - so he stops at holes and walls and cannot fall into the water.
   The pictures face right and are mirrored at draw time. graphics/enemy_anims/gorilla/gorilla_idle_01..02.webp and gorilla_atk_01..30.webp.
   Level entry: [10, start x, (unused), (unused), ground y]  - the two middle numbers used to be a walk range and are ignored now. */
    var GORF = seqImgs('graphics/enemy_anims/gorilla/', FRAMES_GORILLA_ATTACK, 'gorilla_atk_'), GORI = seqImgs('graphics/enemy_anims/gorilla/', FRAMES_GORILLA_IDLE, 'gorilla_idle_');
    /* GOR_REACH = longest jump (was 125, +10%), GOR_ARC = jump height (was 34, then 37.4, now 44.9 = +20% more), GOR_UP / GOR_DROP = highest step he can jump up / deepest drop he jumps down,
   GOR_WATER = ground lower than this is water, GOR_TPF = ticks per attack picture (was 2.4, then 3, now 6 = half the speed again), GOR_REC / GOR_CD doubled too (34 -> 68), GOR_CD = rest between jumps, GOR_STOMP = landing damage radius, PIL_H = height of the water pillars */
    function gorTop(px, y0) {
        var best = null;
        L.s.forEach(function (s) {
            if (px >= s[0] && px <= s[0] + s[2]) {
                var t = s[1];
                if (t >= y0 - GOR_UP && t <= y0 + GOR_DROP && t < GOR_WATER && (best === null || t < best))
                    best = t;
            }
        });
        return best;
    }
    function gorLand(e, gcx, pcx, y0) {
        var dx = pcx - gcx, dir = dx < 0 ? -1 : 1, dmax = Math.min(Math.abs(dx), e.jl || GOR_REACH), d, cx, tc, tl, tr;
        for (d = dmax; d >= 0; d -= 5) {
            cx = gcx + dir * d;
            tc = gorTop(cx, y0);
            if (tc === null)
                continue;
            tl = gorTop(cx - 8, y0);
            tr = gorTop(cx + 8, y0);
            if (tl === null && tr === null)
                continue;
            if (sol({ x: cx - 9, y: tc - e.h, w: 18, h: e.h - 5 }))
                continue;
            return { x: cx, y: tc };
        }
        return null;
    }
    function gorOnScreen(e) {
        return e.x + e.w > cam - 6 && e.x < cam + 206 && e.y + e.h > camY && e.y < camY + 150;
    }
    /* stuck out of sight (hole, wall): put him on the ground behind you, outside the screen, so he can follow on */
    function gorBehind(e, pcx) {
        var side = e.x + e.w / 2 < pcx ? -1 : 1, feet = P.y + P.h, d, cx, best, t;
        for (d = 230; d <= 330; d += 10) {
            cx = pcx + side * d;
            best = null;
            L.s.forEach(function (q) {
                if ((q[4] === 'g' || q[4] === 'b') && cx >= q[0] + 8 && cx <= q[0] + q[2] - 8 && q[1] < GOR_WATER && Math.abs(q[1] - feet) < 45 && (best === null || q[1] < best))
                    best = q[1];
            });
            if (best === null)
                continue;
            t = best;
            if (sol({ x: cx - 9, y: t - e.h, w: 18, h: e.h - 5 }))
                continue;
            e.x = cx - e.w / 2;
            e.gy = t;
            e.y = t - e.h;
            e.gs = 1;
            e.cd = GOR_CD;
            return true;
        }
        return false;
    }
    function gorUpd(e, dt) {
        var GFT = Math.min(GOR_FT, GORF.length - 1), GFL = Math.min(GOR_FL, GORF.length - 1);
        if (!GOR_ON)
            return;
        var gcx = e.x + e.w / 2, pcx = P.x + P.w / 2, dx = pcx - gcx, vis = G.run && !P.caught, off = vis && e.gs >= 1 && !gorOnScreen(e);
        if (e.gy === undefined)
            e.gy = e.sy + e.h;
        if (off)
            dt *= GOR_CATCH;
        if (e.cd > 0)
            e.cd -= dt;
        if (e.gs === 0) {
            e.d = dx < 0 ? -1 : 1;
            if (vis && gorOnScreen(e) && okSet(GORF)) {
                e.gs = 1;
                e.cd = 20;
            }
        } else if (e.gs === 1) {
            e.d = dx < 0 ? -1 : 1;
            e.y = e.gy - e.h;
            if (!vis)
                return;
            if (e.cd <= 0) {
                e.jl = off ? GOR_REACH : (GOR_JMIN + Math.random() * (GOR_JMAX - GOR_JMIN)) * GOR_M;
                /* in sight: every jump is a new random length, 3 to 7 metres (hero = 11.8 m = 38 units); out of sight he jumps far and fast to catch up */
                var ld = gorLand(e, gcx, pcx, e.gy);
                if (ld) {
                    e.stk = 0;
                    e.gs = 2;
                    e.gt = 0;
                    e.tk = 0;
                    e.ld = ld;
                    e.y0 = e.gy;
                    if (Math.abs(ld.x - gcx) > 1)
                        e.d = ld.x > gcx ? 1 : -1;
                } else {
                    e.cd = 18;
                    if (off) {
                        e.stk = (e.stk || 0) + 18;
                        if (e.stk >= GOR_STUCK && gorBehind(e, pcx))
                            e.stk = 0;
                    }
                }
            }
        } else if (e.gs === 2) {
            e.gt += dt;
            var f = GOR_F0 + e.gt / GOR_TPF, air = (GFL - GFT) * GOR_TPF;
            if (!e.tk && f >= GFT) {
                e.tk = 1;
                e.t0 = e.gt;
                e.x0 = gcx;
                var ld2 = gorLand(e, gcx, pcx, e.gy);
                if (ld2)
                    e.ld = ld2;
                e.ah = Math.max(12, Math.min(GOR_ARC, Math.abs(e.ld.x - gcx) * 0.9 + 10));
                /* short jump = low arc */
                if (gorOnScreen(e))
                    sampSnd(GRLB, 1);
                else
                    sfx(120, 0.1, 'square', 60);
            }
            if (e.tk && f < GFL) {
                var u = Math.max(0, Math.min(1, (e.gt - e.t0) / air));
                e.x = e.x0 + (e.ld.x - e.x0) * u - e.w / 2;
                e.y = e.y0 + (e.ld.y - e.y0) * u - (e.ah || GOR_ARC) * 4 * u * (1 - u) - e.h;
            }
            if (f >= GFL) {
                e.x = e.ld.x - e.w / 2;
                e.gy = e.ld.y;
                e.y = e.gy - e.h;
                e.gs = 3;
                e.gt = 0;
                var gn = e.gy;
                burst(e.x + e.w / 2 - 8, gn - 2, '#9a8a70');
                burst(e.x + e.w / 2 + 8, gn - 2, '#9a8a70');
                sfx(80, 0.3, 'sawtooth', 35);
                if (vis && Math.abs(pcx - (e.x + e.w / 2)) < GOR_STOMP + P.w / 2 && P.y + P.h > gn - 16 && P.y + P.h < gn + 30)
                    hurt(1);
            }
        } else {
            e.gt += dt;
            e.y = e.gy - e.h;
            if (e.gt >= GOR_REC) {
                e.gs = 1;
                e.cd = GOR_CD;
            }
        }
    }
    function gorDraw(e) {
        var gcx = e.x + e.w / 2, feet = e.y + e.h, N = GORF.length;
        if (!okSet(GORF) || !okSet(GORI))
            return;
        var hit = e.hc > 0 && (e.hc | 0) % 4 < 2 ? 0.5 : 1;
        function put(img, xx, yy, al) {
            x.globalAlpha = al * hit;
            x.drawImage(img, -xx * GOR_K, -yy * GOR_K, img.naturalWidth * GOR_K, img.naturalHeight * GOR_K);
        }
        x.save();
        x.translate(gcx, feet);
        if (e.d < 0)
            x.scale(-1, 1);
        if (e.gs === 2) {
            var f = Math.max(0, Math.min(N - 1, GOR_F0 + e.gt / GOR_TPF)), j = Math.floor(f), fr = (f - j) * 0.6;
            put(GORF[j], GOR_AAX, GOR_AAY, 1);
            if (j < N - 1 && fr > 0.02)
                put(GORF[j + 1], GOR_AAX, GOR_AAY, fr);
        } else if (e.gs === 3) {
            var r = Math.min(1, e.gt / GOR_REC);
            put(GORF[N - 1], GOR_AAX, GOR_AAY, 1 - r);
            put(GORI[0], GOR_IAX, GOR_IAY, r);
        } else {
            var iph = (Math.sin(T * 0.035) + 1) / 2;
            put(GORI[0], GOR_IAX, GOR_IAY, 1);
            put(GORI[1], GOR_IAX, GOR_IAY, iph * 0.8);
        }
        x.globalAlpha = 1;
        x.restore();
    }
    /* ---- WOMAN BOSS (enemy kind 11): stands in front of the end boss (where the two skeletons used to be), turns toward you and shoots a big pistol
   every WB_PERIOD ticks (120 = 2 s). WB_HP hits to kill, never comes back. Pictures face LEFT and are mirrored at draw time:
   graphics/enemy_anims/womanboss/womanboss_idle_01..07.png (idle turn, played forward / hold / backward) and womanboss_atk_01..06.png.
   Level entry: [11, x, x, x, ground y] */
    var WB_SEQ = [0, 1, 2, 3, 4, 5, 3, 2, 1, 0], WB_IDLE = [0, 1, 2, 3, 4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0], WBA = seqImgs('graphics/enemy_anims/womanboss/', FRAMES_WOMANBOSS_ATTACK, 'womanboss_atk_', '.png'), WBI = seqImgs('graphics/enemy_anims/womanboss/', FRAMES_WOMANBOSS_IDLE, 'womanboss_idle_', '.png');
    /* WB_TPF = ticks per attack picture, WB_RANGE = she starts shooting when you are closer than this, WB_SPEED = bullet speed, WB_AIM = how steeply she may aim up/down,
   WB_SEQ = order of the 6 attack pictures, WB_REL = position in WB_SEQ where the shot leaves (the muzzle flash picture), WB_MX/WB_MY = muzzle position (units from her feet) */
    function wbUpd(e, dt) {
        if (!WB_ON)
            return;
        var dx = P.x + P.w / 2 - (e.x + e.w / 2), N = WB_SEQ.length, vis = G.run && !P.caught;
        e.it = (e.it || 0) + dt;
        if (e.ac2 > 0)
            e.ac2 -= dt;
        if (e.ap < 0) {
            e.d = dx < 0 ? -1 : 1;
            if (e.ac2 <= 0 && vis && Math.abs(dx) < WB_RANGE && okSet(WBA)) {
                e.ap = 0;
                e.sh = 0;
                e.ac2 = WB_PERIOD;
            }
        } else {
            e.ap += dt / WB_TPF;
            if (!e.sh && e.ap >= WB_REL) {
                e.sh = 1;
                wbShoot(e);
            }
            if (e.ap >= N)
                e.ap = -1;
        }
    }
    function wbShoot(e) {
        var d = e.d, sx = e.x + e.w / 2 + d * WB_MX, sy = e.y + e.h - WB_MY, tx = P.x + P.w / 2, ty = P.y + P.h * 0.4, dx = tx - sx, dy = ty - sy, sl = 0;
        if (dx * d > 0)
            sl = Math.max(-WB_AIM, Math.min(WB_AIM, dy / Math.max(30, Math.abs(dx))));
        var vx = d * WB_SPEED / Math.sqrt(1 + sl * sl);
        AR.push({ x: sx, y: sy, vx: vx, vy: sl * Math.abs(vx), l: 200, k: 1 });
        if (!sampSnd(WBSB, WBS_VOL)) {
            sfx(260, 0.14, 'square', 50);
            sfx(1200, 0.06, 'sawtooth', 300);
        }
        burst(sx, sy, '#ffd890');
    }
    function wbDraw(e) {
        if (!okSet(WBA) || !okSet(WBI))
            return;
        var feet = e.y + e.h, cx = e.x + e.w / 2, N = WB_SEQ.length, im, im2 = null, w = 0, hit = e.hc > 0 && (e.hc | 0) % 4 < 2 ? 0.5 : 1;
        if (e.ap >= 0) {
            var f = Math.min(N - 0.001, e.ap), j = Math.floor(f);
            im = tb(WBA, WB_SEQ[j]);
            w = (f - j) * 0.6;
            if (j < N - 1 && w > 0.02)
                im2 = tb(WBA, WB_SEQ[j + 1]);
        } else {
            var n = WB_IDLE.length, p = (e.it || 0) / WB_IT % n, j2 = Math.floor(p);
            im = tb(WBI, WB_IDLE[j2]);
            w = p - j2;
            var nx = WB_IDLE[(j2 + 1) % n];
            if (nx !== WB_IDLE[j2] && w > 0.02)
                im2 = tb(WBI, nx);
        }
        if (!im || !im.naturalWidth)
            return;
        var iw = im.naturalWidth * WB_K, ih = im.naturalHeight * WB_K;
        x.save();
        x.translate(cx, feet);
        if (e.d > 0)
            x.scale(-1, 1);
        x.globalAlpha = hit;
        x.drawImage(im, -WB_AX * WB_K, -WB_AY * WB_K, iw, ih);
        if (im2 && im2.naturalWidth) {
            x.globalAlpha = w * hit;
            x.drawImage(im2, -WB_AX * WB_K, -WB_AY * WB_K, im2.naturalWidth * WB_K, im2.naturalHeight * WB_K);
        }
        x.restore();
    }
    var ROPEF = seqImgs('graphics/hero_rope/', FRAMES_HERO_ROPE_HANG, 'rope_'), ROPE_SAFE = function (i) {
            i = Math.floor(i);
            return i <= 11 || i >= 18 && i <= 26 || i >= 34;
        };
    function ropeDraw() {
        var h = P.hg, mx = P.x + 5, w = h.x1 - h.x0 + 8, s = Math.max(0, Math.min(1, (mx - (h.x0 - 4)) / w)), ry = h.ry + 40 * s * (1 - s), th = Math.atan(40 * (1 - 2 * s) / w) * ROPE_TILT, N = ROPEF.length, f = ((P.rf || 0) % N + N) % N, j0 = Math.floor(f), fr = f - j0, j1 = (j0 + 1) % N, iw = ROPEF[0].naturalWidth * ROPE_K, ih = ROPEF[0].naturalHeight * ROPE_K;
        x.save();
        x.translate(mx, ry);
        x.rotate(th);
        if (P.face < 0)
            x.scale(-1, 1);
        x.drawImage(ROPEF[j0], -ROPE_AX * ROPE_K, -ROPE_AY * ROPE_K, iw, ih);
        if (fr > 0.04) {
            x.globalAlpha = fr * 0.55;
            x.drawImage(ROPEF[j1], -ROPE_AX * ROPE_K, -ROPE_AY * ROPE_K, iw, ih);
            x.globalAlpha = 1;
        }
        x.restore();
    }
    var DANCEF = seqImgs('graphics/hero_dance/', FRAMES_HERO_DANCE, 'dance_'), DNC = { w: 40.92, h: 48.29, ax: 21.68, gy: 47.9 };
    /* ---- VINE LEAP (graphics/hero_swing_leap/swing_leap_01..19, from hero_swing.zip, cut out): plays while she flies from one vine toward the next after she lets go of a vine
   (jump key while swinging). Jumping from the GROUND keeps the normal jump animation, hanging on a vine keeps the hang animation. When she lands on the ground after the leap
   she goes into the crouch (crouch hold) and stands up again to idle. VL_ON 1/0, VL_TPF = game ticks per picture (1.7 = all 19 pictures in about 32 ticks, the last one is held),
   VL_HOLD = extra ticks she stays crouched after landing, VL_AY = height of the body centre above her feet, VLD.k = units per picture pixel. BR_ANCH = share of the bridge picture
   above the walking line (.76 puts the planks on the ground line). SK_SWORD: see skSword. ---- */
    var VLF = seqImgs('graphics/hero_swing_leap/', FRAMES_HERO_SWING_LEAP, 'swing_leap_'), VLD = {
            k: 0.19,
            w: 284,
            h: 300,
            ax: [112.7, 113, 114, 116, 118.5, 121.9, 125, 128.5, 131.4, 135.4, 139.5, 144.8, 150.2, 156.6, 162, 167.8, 172.3, 177.2, 179.1],
            ay: [139.9, 139.6, 138.8, 137.6, 136.5, 135.4, 135, 135.1, 136.4, 138.8, 141.6, 145.2, 149, 153.3, 156.7, 159.4, 161.1, 161.7, 161.9]
        };
    /* ---- CHIMP (enemy kind 12): hangs on a vine and throws a coconut at you every CHM_PERIOD ticks (5 seconds) as long as you are close. graphics/chimp/: chimp_hang_01..48
   (idle, swinging on the vine with the coconut in his hand), chimp_throw_01..12 (the throw), coconut.webp (the flying coconut). He always hangs on the same vine and swings round it
   to face you. Level entry: [12, vine x, vine x, vine x, ground y]. He hangs CHM_LIFT units above the ground (crouch to run under him), CHM_HP hits to kill, 150 points.
   CHM_PERIOD = ticks from one throw start to the next (300 = 5 s), CHM_RANGE = he throws when you are closer than this (units), CHM_TPF = ticks per throw picture, CHM_ITPF = ticks per idle picture,
   CHM_REL = throw picture where the coconut leaves his hand, CHM_FLY = coconut speed (units per tick, the flight time follows from the distance), CHM_GRAV = coconut gravity,
   CHM_K = picture size (units per picture pixel), CHM_BODY = how far his body hangs beside the vine, CHM_TOPY = distance picture top -> top of his hit box, CHM_ROPE = rope length above him.
   Your whip or knife knocks a coconut away (25 points). ---- */
    var CHM_AXH = [
            101,
            101.4,
            101.4,
            101.6,
            101.6,
            101.4,
            101.2,
            100.8,
            100.2,
            99.6,
            98.7,
            97.9,
            96.9,
            96.1,
            94.9,
            93.8,
            92.6,
            91.6,
            90.4,
            89.6,
            88.6,
            88.2,
            87.6,
            87.2,
            86.8,
            86.7,
            86.7,
            86.9,
            87.3,
            87.6,
            88.4,
            88.9,
            89.9,
            90.6,
            91.8,
            92.4,
            93.9,
            94.7,
            96,
            96.8,
            98.1,
            98.6,
            99.6,
            100.3,
            101,
            101.4,
            101.8,
            101.8
        ], CHM_AXT = [34.6, 35.3, 35.6, 36.2, 36.6, 37.6, 38, 39, 38, 37, 38, 36], CHF = seqImgs('graphics/chimp/', FRAMES_CHIMP_HANG, 'chimp_hang_'), CHT = seqImgs('graphics/chimp/', FRAMES_CHIMP_THROW, 'chimp_throw_'), COCO = new Image(), CC = [];
    COCO.src = imgSrc('graphics/chimp/coconut.webp');
    function chimpUpd(e, dt) {
        if (!CHM_ON)
            return;
        var dx = P.x + P.w / 2 - e.sx;
        if (e.cs === 1) {
            e.cp += dt / CHM_TPF;
            if (!e.rl && e.cp >= CHM_REL) {
                e.rl = 1;
                chimpThrow(e);
            }
            if (e.cp >= 12) {
                e.cs = 0;
                e.cc = CHM_PERIOD - 12 * CHM_TPF;
                e.xi = e.li;
                e.xax = e.lax;
                e.xa = 1;
            }
        } else {
            if (Math.abs(dx) > 14)
                e.d = dx < 0 ? -1 : 1;
            if (e.cc > 0)
                e.cc -= dt;
            if (e.cc <= 0 && G.run && !P.caught && Math.abs(dx) < CHM_RANGE && Math.abs(P.y - e.y) < 130 && e.sx > cam - 10 && e.sx < cam + 210 && okSet(CHT)) {
                e.cs = 1;
                e.cp = 0;
                e.rl = 0;
                e.xi = e.li;
                e.xax = e.lax;
                e.xa = 1;
                sfx(330, 0.1, 'triangle', 150);
            }
        }
        e.x = e.sx + (e.d < 0 ? CHM_BODY : -CHM_BODY) - e.w / 2;
    }
    function chimpThrow(e) {
        var sg = e.d < 0 ? 1 : -1, sx = e.sx + sg * 4.1, sy = e.y - CHM_TOPY + 1.6, tx = P.x + P.w / 2, ty = P.y + P.h * 0.45, dx = tx - sx, dy = ty - sy, T2 = Math.max(26, Math.min(80, Math.abs(dx) / CHM_FLY));
        CC.push({ x: sx, y: sy, vx: dx / T2, vy: (dy - 0.5 * CHM_GRAV * T2 * T2) / T2, a: 0, l: T2 + 150 });
        if (!sampSnd(CHATB, CHAT_VOL)) {
            sfx(260, 0.12, 'triangle', 110);
            sfx(150, 0.1, 'sawtooth', 70);
        }
    }
    function coconutBreak(q) {
        burst(q.x, q.y, '#8a5a2a');
        burst(q.x, q.y, '#d6b27a');
        sfx(200, 0.1, 'square', 90);
    }
    function coconutUpd(dt, mb) {
        CC.forEach(function (q) {
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            q.vy += CHM_GRAV * dt;
            q.a += 0.3 * dt;
            q.l -= dt;
            if (q.y > 260) {
                q.l = 0;
                return;
            }
            var r = { x: q.x - 2.6, y: q.y - 2.6, w: 5.2, h: 5.2 };
            if (sol(r)) {
                q.l = 0;
                coconutBreak(q);
                return;
            }
            if (mb && ov(mb, r)) {
                q.l = 0;
                coconutBreak(q);
                G.score += 25;
                return;
            }
            if (ov(r, { x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 2 })) {
                q.l = 0;
                coconutBreak(q);
                hurt(1);
            }
        });
        CC = CC.filter(function (q) {
            return q.l > 0;
        });
    }
    function coconutDraw() {
        if (!COCO.complete || !COCO.naturalWidth)
            return;
        CC.forEach(function (q) {
            x.save();
            x.translate(q.x, q.y);
            x.rotate(q.a);
            x.drawImage(COCO, -3.6, -3.6, 7.2, 7.2);
            x.restore();
        });
    }
    function chimpRope(e) {
        var vx = e.sx;
        if (vx < cam - 10 || vx > cam + 210)
            return;
        var gy = e.sy + e.h + CHM_LIFT, y0 = e.ry !== undefined ? e.ry : gy - CHM_ROPE, y1 = e.y - CHM_TOPY + 10, yy, i;
        x.save();
        x.lineCap = 'round';
        x.strokeStyle = '#2c2412';
        x.lineWidth = 2.6;
        x.beginPath();
        x.moveTo(vx, y0);
        x.lineTo(vx, y1);
        x.stroke();
        x.strokeStyle = '#7a6532';
        x.lineWidth = 1.7;
        x.beginPath();
        x.moveTo(vx, y0);
        x.lineTo(vx, y1);
        x.stroke();
        x.strokeStyle = '#b09a52';
        x.lineWidth = 0.7;
        x.beginPath();
        for (yy = y0; yy < y1; yy += 3) {
            x.moveTo(vx - 0.8, yy);
            x.lineTo(vx + 0.8, yy + 2);
        }
        x.stroke();
        for (yy = y0 + 4, i = 0; yy < y1 - 6; yy += 11, i++) {
            var sd = i % 2 ? 1 : -1;
            x.fillStyle = i % 3 ? '#5f9a2c' : '#3f7a1e';
            x.beginPath();
            x.ellipse(vx + sd * 2.6, yy, 2.6, 1.2, sd * 0.6, 0, 6.3);
            x.fill();
        }
        x.restore();
    }
    function chimpDraw(e, late) {
        if (!okSet(CHF) || !okSet(CHT))
            return;
        if (!late) {
            chimpRope(e);
            return;
        }
        var top = e.y - CHM_TOPY, i, img, ax, w = CHM_W * CHM_K, h = CHM_H * CHM_K, hf = e.hc > 0 && (e.hc | 0) % 4 < 2 ? 0.5 : 1;
        if (e.cs === 1) {
            i = Math.min(11, Math.floor(e.cp));
            img = tb(CHT, i);
            ax = tb(CHM_AXT, i);
        } else {
            i = Math.floor((T + e.t) / CHM_ITPF) % 48;
            img = tb(CHF, i);
            ax = CHM_AXH[i];
        }
        x.save();
        x.translate(e.sx, 0);
        if (e.d > 0)
            x.scale(-1, 1);
        x.globalAlpha = hf;
        x.drawImage(img, -ax * CHM_K, top, w, h);
        if (e.xa > 0 && e.xi) {
            x.globalAlpha = hf * e.xa;
            x.drawImage(e.xi, -e.xax * CHM_K, top, w, h);
            e.xa -= 0.13;
        }
        x.restore();
        e.li = img;
        e.lax = ax;
    }
    function cheatChimp() {
        var c = EN.filter(function (e) {
            return e.k === 12;
        })[0];
        if (!c)
            return;
        if (G.dn)
            danceEnd('');
        if (P.cr) {
            P.cr = 0;
            P.h = 38;
        }
        c.dead = 0;
        c.hp = c.hp0;
        P.x = c.sx - 52;
        P.y = c.sy - 80;
        P.vx = P.vy = 0;
        P.cl = P.sv = P.hg = P.sw = 0;
        P.fall = 0;
        P.caught = 0;
        P.on = 0;
        P.ct = 0;
        P.inv = 60;
        P.face = 1;
        cam = P.x - 95;
        camY = Math.max(-180, Math.min(100, P.y + P.h / 2 - 70));
        G.msg = 'CHEAT: CHIMP';
        G.mt = 120;
    }
    /* ---- CLOUDS (graphics/clouds/cloud_01..05.webp): a few small, very transparent clouds in the blue sky ABOVE the palm crowns. They are part of the level (fixed world height, so they never follow
   the hero up/down); only a slight sideways parallax. Layer: after the background, before palms / terrain / enemies (so nothing needs clipping against the mountains).
   Height: CL_Y units above the highest palm crown of the level (L.pal), plus the y offset of each cloud. CL_ON 1/0, CL_ALPHA = overall opacity, CL_DRIFT = slow own drift to the left (units per tick).
   Every cloud in CLS: [picture 0-4, start x (units, 0-CL_SPAN), y offset (units, up = negative), width (units), opacity, parallax (1 = scrolls like the level, smaller = slower, farther away)]. ---- */
    var CLF = seqImgs('graphics/clouds/', FRAMES_CLOUDS, 'cloud_'), CLS = [
            [0, 20, -6, 56, 1, 0.5], [3, 150, 10, 44, 1, 0.66], [1, 280, -14, 64, 1, 0.4], [4, 370, 4, 48, 1, 0.78]
        ];
    function cloudDraw(cam, cx) {
        if (!CL_ON || !okSet(CLF))
            return;
        if (L.cty === undefined) {
            var m = 1000000000;
            (L.pal || []).forEach(function (q) {
                if (q[1] < m)
                    m = q[1];
            });
            L.cty = m > 100000000 ? 60 : m;
        }
        var i, c, im, w, h, sx, top = L.cty - CL_Y;
        x.save();
        for (i = 0; i < CLS.length; i++) {
            c = CLS[i];
            im = tb(CLF, c[0]);
            w = c[3];
            h = w * im.naturalHeight / im.naturalWidth;
            sx = ((c[1] - cam * c[5] - T * CL_DRIFT) % CL_SPAN + CL_SPAN) % CL_SPAN - 90;
            x.globalAlpha = CL_ALPHA * c[4];
            x.drawImage(im, cx + sx, top + c[2] - h, w, h);
        }
        x.restore();
    }
    /* ---- PRINCESS DANCE (graphics/princess_dance/princess_dance_01..82, from dance_princess.zip, cut out): when the hero reaches the princess at the end of the level both
   dance next to each other, DANCE_LOOPS times. The princess animation lasts exactly as long as the hero's (82 pictures spread over FRAMES_HERO_DANCE*DANCE_TPF ticks).
   PR_ON 1/0, PR_X / PR_FY = where she stands (centre x, feet y), PR_DX = distance between the two dancers, PR_K = size (units per picture pixel). Before the dance she
   stands there (picture 1) as soon as the end boss is dead. ---- */
    var PRF = seqImgs('graphics/princess_dance/', FRAMES_PRINCESS_DANCE, 'princess_dance_');
    /* the princess hangs in the temple door as a SPRITE (graphics/princess_dance/princess_hang.webp) in front of the background, which no longer has her painted in. She hangs there until
   the hero reaches her; then the real dance starts and she is gone from the door. PRH_X = centre x, PRH_FY = y of her feet, PRH_K = units per picture pixel, PRH_ON 1/0. */
    var PRH = new Image();
    PRH.src = 'graphics/princess_dance/princess_hang.webp';
    function hangDraw() {
        if (!PRH_ON || LI !== LV.length - 1 || G.pwin || !PRH.complete || !PRH.naturalWidth)
            return;
        if (PRH_X > cam + 330 || PRH_X < cam - 120)
            return;
        var w = PRH.naturalWidth * PRH_K, h = PRH.naturalHeight * PRH_K;
        x.drawImage(PRH, PRH_X - w / 2, PRH_FY - h, w, h);
    }
    var BWALKF = seqImgs('graphics/boss/walk/', FRAMES_BOSS_WALK, 'bwalk_', '.png'), CAPF = seqImgs('graphics/boss/', FRAMES_CAPTIVE, 'captive_', '.png'), HIDF = seqImgs('graphics/hero_idle/', FRAMES_HERO_IDLE, 'idle_new_');
    var CAP_LAST = -1;
    function capStop() {
        if (CAPS) {
            try {
                CAPS.stop(0);
            } catch (e) {
            }
            CAPS = null;
        }
        CAP_LAST = -1;
    }
    function captiveDraw() {
        /* the scene is gone (and silent) as soon as the end boss is defeated or the princess is saved */
        if (!CAP_ON || LI !== LV.length - 1 || G.pwin || !BS || BS.dead) {
            capStop();
            return;
        }
        if (CAP_X > cam + 400 || CAP_X < cam - 200) {
            capStop();
            return;
        }
        var n = (T / CAP_TPF | 0) % CAPF.length, im = CAPF[n];
        if (!im || !im.complete || !im.naturalWidth)
            return;
        if (n === 0 && CAP_LAST !== 0 && CAP_VOL > 0 && CAPB && A.ctx && A.fx && !G.pause) {
            /* start of a loop: play the sound once, only while the scene is on screen */
            capStop();
            try {
                var sn = A.ctx.createBufferSource(), gn = A.ctx.createGain();
                sn.buffer = CAPB;
                gn.gain.value = CAP_VOL;
                sn.connect(gn);
                gn.connect(A.m);
                sn.start(0);
                CAPS = sn;
            } catch (e) {
            }
        }
        CAP_LAST = n;
        var w = im.naturalWidth * CAP_K, h = im.naturalHeight * CAP_K;
        x.save();
        x.globalAlpha = CAP_ALPHA;
        x.drawImage(im, CAP_X - w / 2, CAP_FY - h, w, h);
        x.restore();
    }
    function princessDance() {
        G.pwin = 1;
        P.face = 1;
        P.x = PR_X - PR_DX - 5;
        P.y = PR_FY - P.h;
        /* both dance on the temple floor between the two torches (torches at x 17974 and 18061) */
        danceStart();
        G.msg = 'YOU SAVED THE PRINCESS!';
        G.mt = FRAMES_HERO_DANCE * DANCE_TPF * DANCE_LOOPS;
    }
    function princessDraw() {
        if (!PR_ON || LI !== LV.length - 1 || !okSet(PRF))
            return;
        var d = G.dn && G.pwin;
        if (!d)
            return;
        if (PR_X > cam + 320 || PR_X < cam - 120)
            return;
        var i = d ? Math.min(FRAMES_PRINCESS_DANCE - 1, Math.floor(G.dn.t % (FRAMES_HERO_DANCE * DANCE_TPF) / (FRAMES_HERO_DANCE * DANCE_TPF / FRAMES_PRINCESS_DANCE))) : 0, im = PRF[i], w = im.naturalWidth * PR_K, h = im.naturalHeight * PR_K;
        x.drawImage(im, PR_X - w / 2, PR_FY - h, w, h);
    }
    /* sword hit zone per attack picture 22..26 (from the pictures): [reach from his centre, lowest, highest] in units */
    var SKH = [[22, 22, 47], [30, 20, 35], [32, 9, 24], [30, 20, 35], [22, 22, 47]];
    function atkLen(e) {
        return e.k === 8 ? SK_ATK_T : ATK_T;
    }
    function skSword(e) {
        var n = FRAMES_SKELETON_ATTACK, f = Math.min(n - 1, Math.floor((1 - e.at / SK_ATK_T) * n)) + 1;
        if (f < SK_HIT_FROM || f > SK_HIT_TO)
            return false;
        var h = SKH[Math.max(22, Math.min(26, f)) - 22], rc = h[0] + SK_REACH, dr = e.d * EFace[8] > 0 ? 1 : -1, cx = e.x + e.w / 2, fy = e.y + e.h;
        return ov({ x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 2 }, { x: dr > 0 ? cx + 8 : cx - rc, y: fy - h[2], w: rc - 8, h: h[2] - h[1] });
    }
    /* the long sword hurts in its last two attack pictures */
    function hero() {
        if (G.dn && okSet(DANCEF)) {
            var di = Math.min(FRAMES_HERO_DANCE - 1, Math.floor(G.dn.t / DANCE_TPF) % FRAMES_HERO_DANCE);
            x.drawImage(DANCEF[di], P.x + 5 - DNC.ax * DANCE_SCALE, P.y + P.h - DNC.gy * DANCE_SCALE, DNC.w * DANCE_SCALE, DNC.h * DANCE_SCALE);
            return;
        }
        if (P.caught)
            return;
        if (P.inv > 0 && (P.inv / 4 | 0) % 2)
            return;
        if (P.hg && ROPE_ON && okSet(ROPEF)) {
            ropeDraw();
            return;
        }
        if (P.cl && CLIMB_ON && okSet(CLIMBF)) {
            climbDraw();
            return;
        }
        if (P.sv && okSet(HANGF)) {
            var s0 = P.sv, L3 = s0.hl || s0.len, hx = s0.x + L3 * Math.sin(s0.th), hy = s0.y + L3 * Math.cos(s0.th), thl = P.face > 0 ? s0.th : -s0.th, hv = L3 * s0.om * Math.cos(s0.th), fwd = (hv > 0 ? 1 : -1) === P.face, lean = Math.min(1, Math.abs(hv) / 2) * (fwd ? 1 : 0.3), nH = HANGF.length - 1, tg = nH * (1 - lean), hi, sway;
            if (P.hfv !== s0) {
                P.hfv = s0;
                P.hfi = 0;
                P.hft = 0;
            }
            /* new grab: start in the leaning catch pose */
            P.hft += 1;
            P.hfi += (tg - P.hfi) * 0.09;
            sway = Math.sin(P.hft / 8) * 2.4 * (nH / 9) * (1 - 0.5 * lean);
            /* body keeps swaying while hanging */
            hi = Math.max(0, Math.min(nH, Math.round(P.hfi + sway)));
            x.save();
            x.translate(hx, hy);
            if (P.face < 0)
                x.scale(-1, 1);
            x.rotate(thl * 0.55);
            x.drawImage(HANGF[hi], -tb(HANGD.grip, hi)[0], -tb(HANGD.grip, hi)[1], HANGD.w, HANGD.h);
            x.restore();
            return;
        }
        if (P.sv && AS.swing && AS.swing.naturalWidth) {
            var s0 = P.sv, hx = s0.x + (s0.hl || s0.len) * Math.sin(s0.th), hy = s0.y + (s0.hl || s0.len) * Math.cos(s0.th), thl = P.face > 0 ? s0.th : -s0.th;
            x.save();
            x.translate(hx, hy);
            if (P.face < 0)
                x.scale(-1, 1);
            x.rotate((thl - 0.2) * 0.8);
            x.drawImage(AS.swing, -SWM.hx * SWK, -SWM.hy, SWM.w * SWK, SWM.h);
            x.restore();
            return;
        }
        var fy = P.y + P.h, mx = P.x + 5, n = HF.length, mv = Math.abs(P.vx) > 0.1, air = !P.on && !P.cl && !P.sw, idx = HM.idle, k, im, x0 = mx + (P.cr ? 9 : 16), y0 = fy - (P.cr ? 15 : 28), dk = AS.crouch, idl = P.on && !mv && !P.cr && !P.cl && !P.sw && !P.hg && !P.sv && okSet(HIDF);
        if (idl) {
            x0 = mx + 11;
            y0 = fy - 25;
        }
        if (air)
            idx = HM.air;
        else if (mv || P.cl && Math.abs(P.vy) > 0 || P.sw && mv)
            idx = Math.floor(P.ph * 1.15 * n / 22) % n;
        if (P.hg)
            idx = K.l || K.r ? Math.floor(P.ph * 1.15 * n / 22) % n : HM.idle;
        if (!air || P.hg || P.cr)
            P.jf = -1;
        im = HF[idx];
        x.save();
        if (P.hg)
            x.translate(0, 10);
        var swOK = P.sw && okSet(SWIMF), waOK = waActive();
        if (P.sw && !swOK) {
            x.translate(mx, P.y + P.h / 2);
            x.rotate(P.face * 1.4);
            x.translate(-mx, -(P.y + P.h / 2));
        } else if (P.face < 0) {
            x.translate(mx, 0);
            x.scale(-1, 1);
            x.translate(-mx, 0);
        }
        if (swOK) {
            var sm = Math.abs(P.vx) > 0.08 || Math.abs(P.vy) > 0.12, st = Math.floor(T / (sm ? 5 : 11)), nF = SWIMF.length, pp = st % (2 * nF - 2), si = pp < nF ? pp : 2 * nF - 2 - pp, scy = P.y + P.h / 2;
            x.save();
            x.translate(mx, scy);
            x.rotate(Math.max(-0.45, Math.min(0.45, P.vy * 0.6)));
            x.drawImage(SWIMF[si], -SWIMD.w * 0.5, -SWIMD.h * 0.5, SWIMD.w, SWIMD.h);
            x.restore();
        } else if (waOK) {
            x.drawImage(tb(WAF, waState(P.wh).k), mx - WAD.ax, fy - WAD.h, WAD.w, WAD.h);
        } else if (CROUCH_ANIM && P.ct > 0 && okSet(CDF) && !air && !P.cl && !P.hg && !P.sw) {
            crouchAnim(mx, fy);
        } else if (P.ct > 0 && AS.down && AS.down.naturalWidth && !P.cl && !P.hg && !P.sw) {
            x.drawImage(AS.down, mx - DN.ax, fy - DN.h + DN.sk, DN.w, DN.h);
        } else if (P.cr && P.on && Math.abs(P.vx) > 0.1 && AS.cw00 && AS.cw00.naturalWidth) {
            var cwi = AS['cw' + CMI()];
            x.drawImage(cwi, mx - CM.ax, fy - CM.gy, CM.w, CM.h);
        } else if (P.cr && dk && dk.naturalWidth) {
            x.drawImage(dk, mx - DK.ax, fy - DK.h + 0.3, DK.w, DK.h);
        } else if (idl) {
            var hn = HIDF.length, hp = 2 * (hn - 1), hs = T / HID_STEP, h0 = Math.floor(hs), hf = hs - h0, hi = function (q) {
                    q %= hp;
                    return q < hn ? q : hp - q;
                };
            x.drawImage(HIDF[hi(h0)], mx - ID.ax * IW, fy - ID.h * IK, ID.w * IW, ID.h * IK);
            if (HID_FADE > 0 && hf > 1 - HID_FADE) {
                x.globalAlpha = (hf - (1 - HID_FADE)) / HID_FADE;
                x.drawImage(HIDF[hi(h0 + 1)], mx - ID.ax * IW, fy - ID.h * IK, ID.w * IW, ID.h * IK);
                x.globalAlpha = 1;
            }
        } else if (VL_ON && air && P.vj && !P.hg && !P.cr && okSet(VLF)) {
            var vi = Math.min(VLF.length - 1, Math.floor(P.vjt / VL_TPF)), vk = VLD.k;
            x.drawImage(VLF[vi], mx - tb(VLD.ax, vi) * vk, fy - VL_AY - tb(VLD.ay, vi) * vk, VLD.w * vk, VLD.h * vk);
            x0 = mx + 5;
            y0 = fy - VL_AY - 6;
        } else if (JUMP_ON && air && !P.hg && !P.cr && okSet(JUMPF)) {
            var ji = jumpIdx(), j0 = Math.floor(ji), jfr = ji - j0, j1 = Math.min(JUMPF.length - 1, j0 + 1), jk = JD.k, jcy = fy - JD.c, jz = 500 * jk, jw = function (i, al) {
                    x.globalAlpha = al;
                    x.drawImage(JUMPF[i], mx - tb(JD.ax, i) * jk, jcy - tb(JD.ay, i) * jk, jz, jz);
                };
            jw(j0, 1);
            if (jfr > 0.08 && j1 !== j0)
                jw(j1, jfr * 0.55);
            x.globalAlpha = 1;
            x0 = mx + (tb(JD.hx, j0) - tb(JD.ax, j0)) * jk;
            y0 = jcy + (tb(JD.hy, j0) - tb(JD.ay, j0)) * jk;
        } else if (im && im.naturalWidth) {
            if (P.cr) {
                x.translate(0, fy);
                x.scale(1.08, 0.62);
                x.translate(0, -fy);
            }
            x.drawImage(im, mx - HM.ax, fy - HM.ay, HM.w, HM.h);
        }
        if (P.hg) {
            limb(mx - 4, fy - 32, mx - 2, fy - 44, 3, '#d9945a', '#f0b080');
            limb(mx + 3, fy - 32, mx + 4, fy - 44, 3, '#d9945a', '#f0b080');
            rc(x, mx - 5, fy - 48, 5, 5, '#2a1a10');
            rc(x, mx + 2, fy - 48, 5, 5, '#2a1a10');
        }
        if (P.wh > 0) {
            var wq2 = (WH_T - P.wh) / WH_T, F = P.face < 0 ? -1 : 1, wax, way, wang, wid, wst, wdr;
            if (waOK) {
                wst = waState(P.wh);
                var we2 = WAD.seq[wst.k];
                wax = mx + F * we2.ex;
                way = fy + we2.ey;
                wang = waAng(wst.s);
                wid = waChain2(wst.s);
                wdr = wst.k >= WAD.seq.length - 1 ? WP_DRV * 0.45 : WP_DRV;
            } else {
                wax = mx + (x0 - mx) * F;
                way = y0;
                var u2 = wq2, e2 = u2 * u2 * (3 - 2 * u2);
                wang = WH_A0 + e2 * (WH_A1 - WH_A0);
                wid = whipChain2(wq2);
                wdr = WP_DRV;
            }
            if (!WP.live)
                wpReset(wax, way, F, wang);
            WP.rx = (wax - mx) * F;
            WP.ry = way - fy;
            WP.ra = wang;
            WP.fade = WP_FADE;
            wpRun(wax, way, F, wang, wid, wdr);
            WP.reach = wpReach(mx, F);
            wpPaint(mx, F, 1);
        } else if (WP.live) {
            var F3 = P.face < 0 ? -1 : 1;
            if (WP.fade > 0) {
                var ft = Math.min(1, (WP_FADE - WP.fade) / 6), fe = ft * ft * (3 - 2 * ft);
                /* the hand goes back to the hip and the whip hangs down from it, falls to the floor and fades */
                wpRun(mx + F3 * (WP.rx + (WP_HX - WP.rx) * fe), fy + WP.ry + (WP_HY - WP.ry) * fe, F3, WP.ra + (1.45 - WP.ra) * fe, null, 0);
                wpPaint(mx, F3, Math.min(1, WP.fade / (WP_FADE * 0.6)));
                WP.fade--;
            } else
                WP.live = 0;
        }
        if (P.mh > 0) {
            var q = (10 - P.mh) / 10, an = -1.5 + q * 2.5;
            x.save();
            x.translate(x0, y0);
            x.rotate(an);
            x.fillStyle = '#eef3fb';
            x.beginPath();
            x.moveTo(5, -2.4);
            x.lineTo(27, -4);
            x.lineTo(32, -1);
            x.lineTo(27, 3);
            x.lineTo(5, 2.4);
            x.closePath();
            x.fill();
            x.fillStyle = '#8fa0b8';
            x.fillRect(5, 0.9, 24, 1.5);
            x.fillStyle = '#4a2a10';
            x.fillRect(-6, -1.8, 11, 3.6);
            x.fillStyle = '#c8a050';
            x.fillRect(4, -3, 1.8, 6);
            x.restore();
            x.strokeStyle = 'rgba(255,255,255,' + 0.55 * (1 - q) + ')';
            x.lineWidth = 2.2;
            x.beginPath();
            x.arc(x0, y0, 25, -1.5, an);
            x.stroke();
        }
        x.restore();
    }
    function crown(px, ty, al) {
        var cr = AS['pc' + Math.abs(px / 7 | 0) % 3];
        if (cr && cr.naturalWidth) {
            var w = cr.naturalWidth / 3.2 * 1.75, h = cr.naturalHeight / 3.2 * 1.75;
            x.globalAlpha = al;
            x.drawImage(cr, px - w / 2, ty - h * 0.52, w, h);
            x.globalAlpha = 1;
        }
    }
    function palm(px, ty, by) {
        var tk = AS.trk;
        if (tk && tk.naturalWidth) {
            var tw = tk.naturalWidth / 3.2 * 1.1, th = tk.naturalHeight / 3.2;
            for (var y = ty + 6; y < by; y += th - 0.6)
                x.drawImage(tk, px - tw / 2, y, tw, th);
        }
        crown(px, ty, 1);
    }
    /* colour cycling overlay for the water you swim in: the same moving palette as the painted lake (see cycBG), blended over the water */
    var LITE = null;
    function lite() {
        if (LITE === null)
            LITE = LIGHT_MODE === 1 || LIGHT_MODE === 0 && /Firefox\//.test(navigator.userAgent);
        return LITE;
    }
    function cycWater(rx, ry, rw, rh, al) {
        if (lite())
            return;
        cycInit();
        if (!PLK || rw <= 0 || rh <= 0)
            return;
        var sc = 0.3, tx = T * 0.2, ty = T * 0.12;
        x.save();
        x.beginPath();
        x.rect(rx, ry, rw, rh);
        x.clip();
        x.globalCompositeOperation = 'overlay';
        x.globalAlpha = al;
        x.translate(tx, ty);
        x.scale(sc, sc);
        x.fillStyle = PLK;
        x.fillRect((rx - tx) / sc, (ry - ty) / sc, rw / sc, rh / sc);
        x.restore();
    }
    function lake(z) {
        var g = x.createLinearGradient(0, z[2], 0, z[2] + 34), i, x0 = Math.floor(cam / 9) * 9;
        g.addColorStop(0, 'rgba(70,200,240,.94)');
        g.addColorStop(1, 'rgba(8,70,135,.98)');
        x.fillStyle = g;
        x.fillRect(cam - 6, z[2], 290, H - z[2] + 40);
        cycWater(cam - 6, z[2], 290, H - z[2] + 40, 0.85);
        var lh = Math.ceil(H + 40 - z[2]) + 4, lx0 = Math.floor(cam / 24) * 24 - 24;
        if (!z._c) {
            z._c = document.createElement('canvas');
            z._c.width = 313 * 4;
            z._c.height = lh * 4;
            z._t = -99;
        }
        if (Math.abs(T - z._t) >= (lite() ? 8 : 3) || T < z._t || z._x !== lx0) {
            var ox2 = x, lg = z._c.getContext('2d');
            lg.setTransform(1, 0, 0, 1, 0, 0);
            lg.clearRect(0, 0, z._c.width, z._c.height);
            x = lg;
            x.setTransform(4, 0, 0, 4, -lx0 * 4, -z[2] * 4);
            for (var yb = z[2]; yb < H + 40; yb += 3) {
                x.fillStyle = 'rgba(150,230,255,' + (0.1 + 0.09 * Math.sin(T / 9 - yb * 0.8)) + ')';
                x.fillRect(lx0, yb, 313, 1.6);
            }
            /* colour cycling: palette bands that slide through the water (same palette as the painted lake) */
            var lc = LKP.length, lcs = T * 0.12 | 0, lk, lxi, ly;
            for (ly = z[2] + 1.5, lk = 0; ly < H + 40; ly += 2.8, lk++)
                for (lxi = 0; lxi < 12; lxi++) {
                    x.fillStyle = 'rgba(' + LKP[(lk + lcs + lxi) % lc] + ',' + (lk < 3 ? 0.34 : 0.5) + ')';
                    x.fillRect(lx0 + lxi * 24 + (lk % 2 ? 3 : 0), ly + Math.sin(lxi * 1.7 + lk * 0.6 + T * 0.05) * 0.7, 25, 2);
                }
            x = ox2;
            z._t = T;
            z._x = lx0;
        }
        x.save();
        x.beginPath();
        x.rect(cam - 6, z[2], 290, H - z[2] + 40);
        x.clip();
        x.drawImage(z._c, lx0, z[2], 313, lh);
        x.restore();
        x.fillStyle = 'rgba(225,250,255,.8)';
        for (i = x0; i < x0 + 300; i += 9) {
            x.fillRect(i + (T / 2 + i * 0.7) % 6, z[2] + 1.5 + Math.sin((T + i) / 8) * 1.2, 5, 1.3);
            x.fillRect(i + 4 + (T / 3 + i) % 5, z[2] + 9 + Math.sin((T + i) / 6) * 1.2, 4, 1);
        }
    }
    /* ---- colour cycling of the painted waterfalls and lake: masks (graphics/backgrounds/water_masks) + a palette pattern that scrolls through them ---- */
    var WMK = [], LMK = [];
    [
        [0, 1], [1, 2], [3, 3], [4, 4]
    ].forEach(function (p) {
        var a = new Image(), b = new Image();
        a.src = imgSrc('graphics/backgrounds/water_masks/waterfall_mask_part_' + p[1] + '.webp');
        b.src = imgSrc('graphics/backgrounds/water_masks/lake_mask_part_' + p[1] + '.webp');
        WMK[p[0]] = a;
        LMK[p[0]] = b;
    });
    var CYV = document.createElement('canvas');
    CYV.width = 800;
    CYV.height = 600;
    var cyx = CYV.getContext('2d'), PWF = null, PLK = null;
    function palAt(pal, t) {
        t = (t % 1 + 1) % 1 * pal.length;
        var i = Math.floor(t), f = t - i, c1 = pal[i % pal.length], c2 = pal[(i + 1) % pal.length];
        return [
            c1[0] + (c2[0] - c1[0]) * f,
            c1[1] + (c2[1] - c1[1]) * f,
            c1[2] + (c2[2] - c1[2]) * f
        ];
    }
    function palStrip(w, h, fn) {
        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        var g = c.getContext('2d'), id = g.createImageData(w, h), i, j, p, col;
        for (j = 0; j < h; j++)
            for (i = 0; i < w; i++) {
                col = fn(i, j);
                p = (j * w + i) * 4;
                id.data[p] = col[0];
                id.data[p + 1] = col[1];
                id.data[p + 2] = col[2];
                id.data[p + 3] = 255;
            }
        g.putImageData(id, 0, 0);
        return c;
    }
    function cycInit() {
        if (PWF)
            return;
        var wfp = [
                [22, 96, 160], [46, 146, 206], [120, 214, 242], [248, 254, 255], [120, 214, 242], [46, 146, 206],
                [22, 96, 160], [14, 74, 138]
            ], lkp = [
                [10, 62, 122], [22, 116, 170], [40, 170, 196], [150, 232, 244], [40, 170, 196], [22, 116, 170],
                [10, 62, 122], [6, 46, 100]
            ];
        PWF = cyx.createPattern(palStrip(24, 96, function (i, j) {
            return palAt(wfp, (j + Math.sin(i * 0.9) * 5 + i % 3 * 2.5) / 96);
        }), 'repeat');
        PLK = cyx.createPattern(palStrip(128, 64, function (i, j) {
            return palAt(lkp, (j + Math.sin(i * 0.09) * 7 + Math.sin(i * 0.31 + j * 0.2) * 2) / 64);
        }), 'repeat');
    }
    function cycBG(segs, vx, sy, tp, VWp, VHp) {
        cycInit();
        var rows = VHp - tp, lay, j, off, w, a, b, mk, k, any, dx, dy, dw, dh, ox, oy;
        if (rows <= 0)
            return;
        for (lay = 0; lay < 2; lay++) {
            if (lay === 1 && sy + rows < 1050)
                continue;
            cyx.setTransform(1, 0, 0, 1, 0, 0);
            cyx.globalCompositeOperation = 'source-over';
            cyx.clearRect(0, 0, 800, 600);
            any = 0;
            off = 0;
            for (j = 0; j < segs.length; j++) {
                w = segs[j].naturalWidth;
                a = Math.max(vx, off);
                b = Math.min(vx + VWp, off + w);
                if (b > a) {
                    mk = (lay ? LMK : WMK)[L.bg[j]];
                    if (mk && mk.naturalWidth) {
                        dx = (a - vx) * 1.25;
                        dy = tp * 1.25;
                        dw = (b - a) * 1.25 + 1;
                        dh = rows * 1.25 + 1;
                        ox = -vx * 1.25 + (lay ? T * 0.5 : 0);
                        oy = -sy * 1.25 + (lay ? T * 0.3 : T * 2.6);
                        /* waterfalls flow down, the lake drifts */
                        cyx.save();
                        cyx.beginPath();
                        cyx.rect(dx, dy, dw, dh);
                        cyx.clip();
                        cyx.globalCompositeOperation = 'source-over';
                        cyx.translate(ox, oy);
                        cyx.fillStyle = lay ? PLK : PWF;
                        cyx.fillRect(dx - ox, dy - oy, dw, dh);
                        cyx.setTransform(1, 0, 0, 1, 0, 0);
                        cyx.globalCompositeOperation = 'destination-in';
                        cyx.drawImage(mk, (a - off) / 4, sy / 4, (b - a) / 4, rows / 4, dx, dy, dw, dh);
                        cyx.restore();
                        any = 1;
                    }
                }
                off += w;
            }
            if (any) {
                x.save();
                x.globalCompositeOperation = 'overlay';
                x.globalAlpha = lay ? 0.55 : 0.7;
                x.drawImage(CYV, 0, 0, 800, 600);
                x.restore();
            }
        }
    }
    /* the painted backgrounds are 14496 px wide (about 67 MB each once decoded). Drawing a small window out of such a huge picture every frame is slow,
       so each one is cut once into 1024 px slices (ImageBitmaps) that are drawn instead. Until a slice is ready the old way is used. */
    var BGCH = 1024;
    function bgPrep(im) {
        if (!im._ch) {
            im._ch = [];
            im._cn = Math.ceil(im.naturalWidth / BGCH);
            im._cb = 0;
        }
        var n = 0;
        while (im._cb < im._cn && n < 3 && !im._cf && window.createImageBitmap) {
            (function (c) {
                var sx0 = c * BGCH, w0 = Math.min(BGCH, im.naturalWidth - sx0);
                createImageBitmap(im, sx0, 0, w0, im.naturalHeight).then(function (bm) {
                    im._ch[c] = bm;
                }, function () {
                    im._cf = 1;
                });
            })(im._cb);
            im._cb++;
            n++;
        }
    }
    function bgDraw(im, sx, sy, sw, sh, dx, dy, dw, dh) {
        if (im._ch && !im._cf) {
            var c0 = Math.floor(sx / BGCH), c1 = Math.floor((sx + sw - 1) / BGCH), c, rdy = true;
            for (c = c0; c <= c1; c++)
                if (!im._ch[c]) {
                    rdy = false;
                    break;
                }
            if (rdy) {
                for (c = c0; c <= c1; c++) {
                    var s0 = Math.max(sx, c * BGCH), s1 = Math.min(sx + sw, (c + 1) * BGCH);
                    x.drawImage(im._ch[c], s0 - c * BGCH, sy, s1 - s0, sh, dx + (s0 - sx) * 1.25, dy, (s1 - s0) * 1.25 + 1, dh);
                }
                return;
            }
        }
        x.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    function draw() {
        var segs = L.bg.map(function (k) {
                return BGS[k];
            }), tot = 0, ok = true, i, dx = Math.round(cam * 4), dy = Math.round(camY * 4), cx = dx / 4, dyb = Math.round(camY * 3.2) + 384, sy = Math.max(0, dyb), tp = sy - dyb, sk = SKYS[L.sky];
        segs.forEach(function (im) {
            if (im.complete && im.naturalWidth) {
                tot += im.naturalWidth;
                bgPrep(im);
            } else
                ok = false;
        });
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.imageSmoothingEnabled = true;
        if (ok) {
            var vx = Math.round(cam * 3.2), off = 0, VWp = 640, VHp = 480;
            if (tp > 0 && sk && sk.naturalWidth) {
                var t2 = Math.min(tp, 192), r = sk.naturalWidth / tot, sw2 = sk.naturalWidth - VWp * r, sx2 = Math.max(0, Math.min(sw2, vx * r));
                x.drawImage(sk, sx2, 192 - t2, VWp * r, t2, 0, (tp - t2) * 1.25, 800, t2 * 1.25);
            }
            segs.forEach(function (im) {
                var w = im.naturalWidth, a = Math.max(vx, off), b = Math.min(vx + VWp, off + w);
                if (b > a && VHp - tp > 0)
                    bgDraw(im, a - off, sy, b - a, VHp - tp, (a - vx) * 1.25, tp * 1.25, (b - a) * 1.25 + 1, (VHp - tp) * 1.25 + 1);
                off += w;
            });
            if (!lite())
                cycBG(segs, vx, sy, tp, VWp, VHp);
        } else {
            x.fillStyle = '#145a3a';
            x.fillRect(0, 0, 800, 600);
        }
        x.setTransform(4, 0, 0, 4, -dx, -dy);
        cloudDraw(cam, cx);
        hangDraw();
        captiveDraw();
        DEC.forEach(function (d) {
            var im = AS[d.n];
            if (!d.f && im && d.x > cx - 50 && d.x < cx + 330)
                sp(d.n, d.x, d.y - im.naturalHeight / 3.2);
        });
        L.w.forEach(function (z) {
            if (z[4])
                lake(z);
            else if (!z[3])
                water(z, 0.8);
        });
        SW.forEach(function (s) {
            if (s.pb)
                palm(s.x - 4, s.y - 8, s.pb + 3);
        });
        (L.pal || []).forEach(function (q) {
            if (q[0] > cx - 60 && q[0] < cx + 330)
                palm(q[0], q[1], q[2]);
        });
        L.s.forEach(solid);
        MP.forEach(function (m) {
            if (m.x > cx - 40 && m.x < cx + 300)
                sp('log', m.x - 1, m.y - 7, m.w + 2, 14);
        });
        HL.forEach(function (h) {
            if (h.x1 < cx - 20 || h.x0 > cx + 300)
                return;
            var tk = AS.trk;
            if (tk && tk.naturalWidth) {
                var PW = HOLE_POST_W, th = tk.naturalHeight / tk.naturalWidth * PW;
                [h.x0 - 4, h.x1 + 4].forEach(function (px) {
                    for (var yy = h.ry - 4; yy < h.yG + 3; yy += th - 0.6)
                        x.drawImage(tk, px - PW / 2, yy, PW, th);
                });
            }
            x.strokeStyle = '#8a5a2b';
            x.lineWidth = 2.2;
            x.beginPath();
            x.moveTo(h.x0 - 4, h.ry);
            x.quadraticCurveTo((h.x0 + h.x1) / 2, h.ry + 20, h.x1 + 4, h.ry);
            x.stroke();
            x.strokeStyle = '#d8a060';
            x.lineWidth = 0.8;
            x.beginPath();
            x.moveTo(h.x0 - 4, h.ry - 0.8);
            x.quadraticCurveTo((h.x0 + h.x1) / 2, h.ry + 19.2, h.x1 + 4, h.ry - 0.8);
            x.stroke();
        });
        L.w.forEach(function (z) {
            if (z[4]) {
                x.fillStyle = 'rgba(18,105,150,.2)';
                x.fillRect(z[0], z[2], z[1], H - z[2]);
            }
        });
        L.v.forEach(function (v) {
            if (!v[4] && v[0] > cam - 30 && v[0] < cam + 310)
                sp((v[0] | 0) % 2 ? 'vp1' : 'vp2', v[0] - 7, v[1] - 4, 14, v[2] - v[1] + 4);
        });
        L.sk.forEach(function (s) {
            if (s[0] > cam + 300 || s[0] + s[1] < cam - 20)
                return;
            sp('spikes', s[0], 178, s[1], 12);
        });
        spikesDraw();
        IT.forEach(function (t) {
            if (t.got || t.x < cam - 40 || t.x > cam + 330)
                return;
            var im = AS[t.n];
            if (im && im.naturalWidth)
                sp(t.n, t.x - im.naturalWidth / 6.4, t.y - im.naturalHeight / 6.4 + Math.sin((T + t.x) / 12) * 2);
        });
        EN.forEach(enemy);
        arrowDraw();
        crocDraw();
        bossDraw();
        L.w.forEach(function (z) {
            if (z[4]) {
                x.fillStyle = 'rgba(20,110,165,.38)';
                x.fillRect(cx - 6, z[2], 300, 40);
            }
        });
        PR.forEach(function (p) {
            rc(x, p.x, p.y, 7, 2, '#dfe6f2');
            rc(x, p.x + (p.vx > 0 ? -3 : 7), p.y, 3, 2, '#6b4526');
        });
        SW.forEach(function (s) {
            if (s.x < cam - 120 || s.x > cam + 400)
                return;
            x.save();
            x.translate(s.x, s.y);
            x.rotate(-s.th);
            sp('vine', -5, 0, 10, s.len);
            x.restore();
        });
        hero();
        princessDraw();
        L.s.forEach(bridgeDraw);
        (L.pal || []).forEach(function (q) {
            if (q[0] > cx - 60 && q[0] < cx + 330)
                crown(q[0], q[1], 0.6);
        });
        EN.forEach(function (e) {
            if (e.k === 12 && !e.dead && e.sx > cx - 60 && e.sx < cx + 260)
                chimpDraw(e, 1);
        });
        coconutDraw();
        /* chimps (head + body) and their coconuts are drawn LAST = always in front of palm trunks, crowns and leaves; only his vine is behind the leaves */
        L.w.forEach(function (z) {
            if (z[3])
                water(z, 0.38);
        });
        DEC.forEach(function (d) {
            var im = AS[d.n];
            if (d.f && im && d.x > cx - 50 && d.x < cx + 330)
                sp(d.n, d.x, d.y - im.naturalHeight / 3.2);
        });
        PA.forEach(function (p) {
            x.fillStyle = p.c;
            x.fillRect(p.x, p.y, 3, 3);
        });
        x.setTransform(4, 0, 0, 4, 0, 0);
        if (G.mt > 0 && G.msg) {
            x.font = '4.5px "Press Start 2P",monospace';
            x.textAlign = 'center';
            x.fillStyle = '#000';
            x.fillText(G.msg, 100.6, 35.6);
            x.fillStyle = '#ffc83d';
            x.fillText(G.msg, 100, 35);
        }
        if (!G.run && !G.won) {
            x.fillStyle = 'rgba(180,0,0,.28)';
            x.fillRect(0, 0, 200, 150);
        }
    }
    /* input */
    var KM = {
        ArrowLeft: 'l',
        a: 'l',
        A: 'l',
        ArrowRight: 'r',
        d: 'r',
        D: 'r',
        ArrowUp: 'u',
        w: 'u',
        W: 'u',
        ArrowDown: 'd',
        s: 'd',
        S: 'd',
        ' ': 'j'
    };
    cv.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (view !== 'game')
            return;
        if (e.button === 2)
            K.d2 = 1;
        else if (e.button === 0)
            atk();
    });
    sc.addEventListener('contextmenu', function (e) {
        if (view === 'game' || view === 'over')
            e.preventDefault();
    });
    document.addEventListener('pointerup', function (e) {
        if (e.button === 2)
            K.d2 = 0;
    });
    document.addEventListener('pointerdown', aud);
    document.addEventListener('keydown', function (e) {
        var k = e.key;
        aud();
        if (view === 'tune') {
            tuneKey(e);
            return;
        }
        if (NAV[view]) {
            var nl = navList();
            if (k === 'ArrowDown' || k === 'ArrowUp') {
                e.preventDefault();
                idx = (idx + (k === 'ArrowDown' ? 1 : nl.length - 1)) % nl.length;
                paint();
                sfx(440, 0.05);
            } else if (k === 'Escape' && view !== 'title') {
                e.preventDefault();
                show(BACKTO[view] || 'menu');
            }
        } else if (view === 'game') {
            if (G.pause && k !== 'p' && k !== 'P' && k !== 'Escape') {
                e.preventDefault();
                return;
            }
            var m = KM[k];
            if (m) {
                e.preventDefault();
                K[m] = 1;
                if (!e.repeat) {
                    if (m === 'u')
                        K.jp = 1;
                    if (k === ' ') {
                        K.jp = 1;
                        K.sj = 1;
                    }
                }
            } else if (k === 'x' || k === 'X' || k === 'z' || k === 'Z') {
                e.preventDefault();
                if (!e.repeat)
                    atk();
            } else if (k === '9') {
                if (!e.repeat && G.run && !G.dn)
                    G.dp = 1;
            } else if (CHEAT_KEYS && k === '0') {
                if (!e.repeat && G.run)
                    cheatSkel();
            } else if (CHEAT_KEYS && k === '8') {
                if (!e.repeat && G.run)
                    cheatArcher();
            } else if (k === '5') {
                if (!e.repeat && G.run)
                    cheatArcher(12275, 'ARCHER 10');
            } else if (CHEAT_KEYS && k === '7') {
                if (!e.repeat && G.run)
                    cheatBoss();
            } else if (CHEAT_KEYS && k === '6') {
                if (!e.repeat && G.run)
                    cheatChimp();
            } else if (k === '1' || k === '2' || k === '3') {
                var n = +k - 1;
                if (n !== 1 || P.hasM)
                    P.wp = n;
            } else if (k === 'q' || k === 'Q') {
                P.wp = (P.wp + 1) % 3;
                if (P.wp === 1 && !P.hasM)
                    P.wp = 2;
            } else if (k === 'p' || k === 'P') {
                e.preventDefault();
                if (!e.repeat && G.run)
                    togglePause();
            } else if (k === 'Escape') {
                stop();
                show('menu');
            }
        } else if (view === 'dance') {
            if (k === 'Enter' || k === ' ' || k === 'Escape') {
                e.preventDefault();
                winScreen();
            }
        } else if (view === 'win') {
            if (k === 'Enter' || k === ' ' || k === 'Escape') {
                e.preventDefault();
                sfx(660, 0.1);
                show('menu');
            }
        } else if (view === 'scores') {
            if (k === 'Escape')
                show('menu');
        } else if (view === 'over' && !$('#entry').hidden) {
            if (k === 'ArrowUp')
                ini[cur] = (ini[cur] + 1) % 26;
            else if (k === 'ArrowDown')
                ini[cur] = (ini[cur] + 25) % 26;
            else if (k === 'ArrowLeft')
                cur = (cur + 2) % 3;
            else if (k === 'ArrowRight')
                cur = (cur + 1) % 3;
            else if (k === 'Enter') {
                e.preventDefault();
                commit();
                return;
            } else if (/^[a-z]$/i.test(k)) {
                ini[cur] = k.toUpperCase().charCodeAt(0) - 65;
                cur = Math.min(2, cur + 1);
            } else
                return;
            e.preventDefault();
            letters();
            sfx(500, 0.05);
        }
    });
    document.addEventListener('keyup', function (e) {
        var m = KM[e.key];
        if (m) {
            K[m] = 0;
            if ((m === 'u' || e.key === ' ') && P && P.vy < -1.1 * JUMP_SLOW)
                P.vy = -1.1 * JUMP_SLOW;
        }
    });
    ['pointerup', 'click', 'touchend', 'mousedown'].forEach(function (n) {
        document.addEventListener(n, aud, { passive: true });
    });
    /* any first click/touch/key starts the soundtracker music in the start menu (browsers only allow sound after one) */
    try {
        aud();
        if (A.ctx)
            A.ctx.onstatechange = function () {
                if (A.ctx.state === 'running')
                    musOn();
            };
    } catch (e) {
    }
    /* try right away: works where the browser allows autoplay */
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            if (A.ctx)
                A.ctx.suspend();
        } else {
            if (A.ctx)
                A.ctx.resume();
            musOn();
        }
    });
    /* colour-cycling logo: the neon letters of the title picture are recoloured every frame (hue wave moving through the letters) */
    (function () {
        var lc = $('#lgc'), art = $('.art');
        if (!lc || !art)
            return;
        var W = 1024, H = 440, lx = lc.getContext('2d'), mk = new Image(), N = 0, ix, al, h0, s0, v0, ph, img, lut = new Float32Array(1080), dl = new Int16Array(256), last = 0, ready = false, i, k, still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        for (i = 0; i < 360; i++) {
            var hh = i / 60, x2 = 1 - Math.abs(hh % 2 - 1), r = 0, g = 0, b = 0, q = hh | 0;
            if (q === 0) {
                r = 1;
                g = x2;
            } else if (q === 1) {
                r = x2;
                g = 1;
            } else if (q === 2) {
                g = 1;
                b = x2;
            } else if (q === 3) {
                g = x2;
                b = 1;
            } else if (q === 4) {
                r = x2;
                b = 1;
            } else {
                r = 1;
                b = x2;
            }
            lut[i * 3] = r;
            lut[i * 3 + 1] = g;
            lut[i * 3 + 2] = b;
        }
        for (k = 0; k < 256; k++)
            dl[k] = Math.round(14 + 26 * Math.sin(6.2831853 * k / 256));
        function build() {
            var c = document.createElement('canvas');
            c.width = W;
            c.height = H;
            var cx = c.getContext('2d');
            cx.drawImage(art, 0, 0, W, H, 0, 0, W, H);
            var d = cx.getImageData(0, 0, W, H).data;
            cx.clearRect(0, 0, W, H);
            cx.drawImage(mk, 0, 0);
            var m = cx.getImageData(0, 0, W, H).data, p, o;
            for (p = 0; p < W * H; p++)
                if (m[p * 4] > 8)
                    N++;
            ix = new Int32Array(N);
            al = new Uint8Array(N);
            h0 = new Float32Array(N);
            s0 = new Float32Array(N);
            v0 = new Float32Array(N);
            ph = new Uint8Array(N);
            img = lx.createImageData(W, H);
            var n = 0;
            for (p = 0; p < W * H; p++) {
                if (m[p * 4] <= 8)
                    continue;
                o = p * 4;
                var rr = d[o] / 255, gg = d[o + 1] / 255, bb = d[o + 2] / 255, mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb), dd = mx - mn, hu = 0;
                if (dd > 0.000001) {
                    if (mx === rr)
                        hu = ((gg - bb) / dd + 6) % 6 * 60;
                    else if (mx === gg)
                        hu = ((bb - rr) / dd + 2) * 60;
                    else
                        hu = ((rr - gg) / dd + 4) * 60;
                }
                var x = p % W, y = p / W | 0;
                ix[n] = p;
                al[n] = m[p * 4];
                h0[n] = hu;
                s0[n] = mx > 0 ? dd / mx : 0;
                v0[n] = mx;
                ph[n] = (x / W * 1.6 + y / H * 0.45) % 1 * 256 | 0;
                img.data[o + 3] = m[p * 4];
                n++;
            }
            ready = true;
        }
        function paint(t) {
            if (!ready)
                return;
            var sh = t * 0.07 * 256 | 0, o = img.data, j, k2, l3, s, v, sc2, ps;
            for (j = 0; j < N; j++) {
                k2 = ph[j] + sh & 255;
                l3 = (((h0[j] + dl[k2]) % 360 + 360) % 360 | 0) * 3;
                s = s0[j];
                v = v0[j];
                sc2 = 1 - s;
                ps = ix[j] * 4;
                o[ps] = v * (sc2 + s * lut[l3]) * 255;
                o[ps + 1] = v * (sc2 + s * lut[l3 + 1]) * 255;
                o[ps + 2] = v * (sc2 + s * lut[l3 + 2]) * 255;
            }
            lx.putImageData(img, 0, 0);
        }
        function tick(ts) {
            requestAnimationFrame(tick);
            var vw = sc.dataset.view;
            if (!/^(title|menu|scores|settings|sound|gfx|quit)$/.test(vw) || document.hidden)
                return;
            if (ts - last < 34)
                return;
            last = ts;
            paint(ts / 1000);
        }
        function start() {
            if (ready)
                return;
            try {
                build();
                paint(0);
            } catch (e) {
                ready = false;
                return;
            }
            if (!still)
                requestAnimationFrame(tick);
        }
        mk.onload = function () {
            if (art.complete && art.naturalWidth)
                start();
            else
                art.addEventListener('load', start);
        };
        mk.src = 'graphics/title/logo_cycling_mask.webp';
    }());
    /* ---- Doom-style status bar ---- */
    var SB = {
        last: '',
        face: -1,
        hearts: [],
        ammo: $('#sbAmmo'),
        arms: [].slice.call(document.querySelectorAll('#sbArms span')),
        wep: $('#sbWep'),
        fimg: $('#sbFace'),
        score: $('#sbScore'),
        gems: $('#sbGems'),
        airL: $('#sbAirL'),
        airF: $('#sbAirF'),
        airP: $('#sbAirL').parentNode,
        armsL: $('#sbArms').parentNode.querySelector('.sbl')
    };
    (function () {
        var hb = $('#sbHearts'), i;
        for (i = 0; i < 5; i++) {
            var im = new Image();
            im.src = ASRC.heart;
            im.alt = '';
            SB.hearts.push(im);
            hb.appendChild(im);
        }
    }());
    var FACES = ['face0', 'face1', 'face2'];
    /* 0 normal, 1 hurt, 2 badly hurt: replace these pictures later (animation hook: faceState()) */
    function faceState() {
        if (!P || !G)
            return 0;
        if (P.caught || P.inv > 52)
            return 1;
        if (P.hp <= 2)
            return 2;
        return 0;
    }
    function sbUpdate() {
        if (G && G.score > 9999999)
            G.score = 9999999;
        if (!P || !G || !G.run && !G.won && view !== 'game' && view !== 'over')
            return;
        var boss = BS && BS.act && !BS.dead, air = boss ? Math.max(0, BS.hp / BS.hp0) : P.wt > 0 ? Math.max(0, 1 - P.wt / 600) : 1, fs = faceState();
        var key = [
            P.hp,
            P.ammo,
            P.wp,
            P.hasM ? 1 : 0,
            G.score,
            G.gems,
            Math.round(air * 50),
            boss ? 1 : 0,
            fs
        ].join(',');
        if (key === SB.last)
            return;
        SB.last = key;
        SB.hearts.forEach(function (im, i) {
            im.classList.toggle('off', i >= P.hp);
        });
        SB.ammo.textContent = P.ammo;
        SB.score.textContent = pad(G.score);
        SB.gems.textContent = G.gems;
        SB.arms.forEach(function (s, i) {
            s.classList.toggle('on', P.wp === i);
            s.classList.toggle('dim', i === 1 && !P.hasM || i === 2 && P.ammo <= 0);
        });
        SB.wep.textContent = ['WHIP', 'MACHETE', 'KNIFE'][P.wp];
        SB.armsL.textContent = ['WHIP', 'MACHETE', 'KNIFE'][P.wp];
        SB.airL.textContent = boss ? 'BOSS' : 'AIR';
        SB.airP.classList.toggle('boss', !!boss);
        SB.airF.style.width = Math.round(air * 100) + '%';
        SB.airF.style.background = !boss && air < 0.3 ? '#ff5030' : '';
        if (fs !== SB.face) {
            SB.face = fs;
            SB.fimg.src = ASRC[FACES[fs]];
        }
    }
    /* ---- win screen ---- */
    $('#winBg').src = $('#winImg').src;
    /* win dance scene: the picture of Jungle Cat and the Princess dancing is shown first; after DANCE_SECONDS or on space/enter/click the win screen blends in */
    var danceTimer = 0;
    function showWin() {
        show('dance');
        clearTimeout(danceTimer);
        danceTimer = setTimeout(winScreen, DANCE_SECONDS * 1000);
    }
    function winScreen() {
        clearTimeout(danceTimer);
        if (view !== 'dance')
            return;
        sfx(660, 0.1);
        show('win');
        $('#winScore').textContent = 'SCORE ' + pad(G.score) + '  GEMS ' + G.gems;
        $('#winBack').focus({ preventScroll: true });
    }
    $('#danV').onclick = winScreen;
    $('#winBack').onclick = function () {
        sfx(660, 0.1);
        show('menu');
    };
    $('#winBack').onmouseenter = function () {
        sfx(520, 0.04);
    };
    show('title');
}());
/* title screen story crawl: the scroll speed is set from the real text height (about 22 pixels per second, so a longer text scrolls longer) */
(function () {
    function fit() {
        var t = document.getElementById('crawlt');
        if (t && t.offsetHeight)
            t.style.animationDuration = Math.round((t.offsetHeight + 120) / 22) + 's';
    }
    fit();
    addEventListener('load', fit);
    if (document.fonts && document.fonts.ready)
        document.fonts.ready.then(fit);
}());
