/*========================================
 *    sl.c: SL version 5.05
 *        Copyright 1993,1998,2014-2015
 *                  Toyoda Masashi
 *                  (mtoyoda@acm.org)
 *        Last Modified: 2024/11/23
 *========================================
 */
/* sl version 5.07 : Add support piping out of SL.                2024/11/29 */
/* sl version 5.06 : Add support piping into SL.                  2024/11/23 */
/* sl version 5.05 : Add support for unicode file names.          2021/01/03 */
/* sl version 5.04 : Add file cars as -f option.                  2020/08/19 */
/* sl version 5.03 : Fix some more compiler warnings.                        */
/*                                              by Ryan Jacobs    2015/01/19 */
/* sl version 5.02 : Fix compiler warnings.                                  */
/*                                              by Jeff Schwab    2014/06/03 */
/* sl version 5.01 : removed cursor and handling of IO                       */
/*                                              by Chris Seymour  2014/01/03 */
/* sl version 5.00 : add -c option                                           */
/*                                              by Toyoda Masashi 2013/05/05 */
/* sl version 4.00 : add C51, usleep(40000)                                  */
/*                                              by Toyoda Masashi 2002/12/31 */
/* sl version 3.03 : add usleep(20000)                                       */
/*                                              by Toyoda Masashi 1998/07/22 */
/* sl version 3.02 : D51 flies! Change options.                              */
/*                                              by Toyoda Masashi 1993/01/19 */
/* sl version 3.01 : Wheel turns smoother                                    */
/*                                              by Toyoda Masashi 1992/12/25 */
/* sl version 3.00 : Add d(D51) option                                       */
/*                                              by Toyoda Masashi 1992/12/24 */
/* sl version 2.02 : Bug fixed.(dust remains in screen)                      */
/*                                              by Toyoda Masashi 1992/12/17 */
/* sl version 2.01 : Smoke run and disappear.                                */
/*                   Change '-a' to accident option.                         */
/*                                              by Toyoda Masashi 1992/12/16 */
/* sl version 2.00 : Add a(all),l(long),F(Fly!) options.                     */
/*                                              by Toyoda Masashi 1992/12/15 */
/* sl version 1.02 : Add turning wheel.                                      */
/*                                              by Toyoda Masashi 1992/12/14 */
/* sl version 1.01 : Add more complex smoke.                                 */
/*                                              by Toyoda Masashi 1992/12/14 */
/* sl version 1.00 : SL runs vomiting out smoke.                             */
/*                                              by Toyoda Masashi 1992/12/11 */

#include "sl.h"
#include <stdint.h>

#define ERR -1
#define OK 0

extern int32_t my_mvaddstr(int32_t y, int32_t x, char *str);
extern int32_t print_car(char *buffer, uint32_t buffer_length, const char *fmt, const char* text, uint32_t text_display_width);
extern void add_man(int32_t y, int32_t x);
extern void add_smoke(int32_t y, int32_t x);

extern int32_t COLS;
extern int32_t LINES;

int32_t add_C51(int32_t x, char *namelist[], int32_t cars);
int32_t add_sl(int32_t x, char *namelist[], int32_t cars);

int32_t ACCIDENT  = 0;
int32_t FLY       = 0;

int32_t add_sl(int32_t x, char* namelist[], int32_t cars)
{
    static char *sl[LOGOPATTERNS][LOGOHEIGHT + 1]
        = {{LOGO1, LOGO2, LOGO3, LOGO4, LWHL11, LWHL12, DELLN},
           {LOGO1, LOGO2, LOGO3, LOGO4, LWHL21, LWHL22, DELLN},
           {LOGO1, LOGO2, LOGO3, LOGO4, LWHL31, LWHL32, DELLN},
           {LOGO1, LOGO2, LOGO3, LOGO4, LWHL41, LWHL42, DELLN},
           {LOGO1, LOGO2, LOGO3, LOGO4, LWHL51, LWHL52, DELLN},
           {LOGO1, LOGO2, LOGO3, LOGO4, LWHL61, LWHL62, DELLN}};

    static char *coal[LOGOHEIGHT + 1]
        = {LCOAL1, LCOAL2, LCOAL3, LCOAL4, LCOAL5, LCOAL6, DELLN};

    static char *car[LOGOHEIGHT + 1]
        = {LCAR1, LCAR2, LCAR3, LCAR4, LCAR5, LCAR6, DELLN};

    int32_t i, j, y, pos, py1 = 0, py2 = 0;
    char carName[NAME_BUFFER];
    if (x < - (LOGOLENGTH + ((cars > 0) ? cars * (LCARLENGTH - 1) : 0))) {
        return ERR;
    }

    y = LINES / 2 - 3;

    if (FLY == 1) {
        y = (x / 6) + LINES - (COLS / 6) - LOGOHEIGHT;
        if (y < (0 - (LOGOHEIGHT + 14))) {
            return ERR;
        }

        py1 = 2;  py2 = 4;
    }

    for (i = 0; i <= LOGOHEIGHT; ++i) {
        if (LOGOLENGTH + x > 0) {
            my_mvaddstr(y + i, x, sl[(LOGOLENGTH + x) / 3 % LOGOPATTERNS][i]);
            my_mvaddstr(y + i + py1, x + LCARLENGTH - 1, coal[i]);
        }
        for (j = 0; j < cars; ++j) {
            pos = LOGOLENGTH + x + (LCARLENGTH - 1) * (j + 1);
            if (pos < 0) {
                continue;
            } else if (pos > COLS + LOGOLENGTH) {
                break;
            }

            print_car(carName, sizeof(carName), car[i], namelist[j], 16);
            my_mvaddstr(y + i + (FLY * j) + py2, x + 42 + (LCARLENGTH - 1) * j, carName);
        }
    }

    if (ACCIDENT == 1) {
        for (j = 0; j < cars; ++j) {
            pos = LOGOLENGTH + x + (LCARLENGTH - 1) * (j + 1);
            if (pos < 0) {
                continue;
            } else if (pos > COLS + LOGOLENGTH) {
                break;
            }

            add_man(y + 1, x + 14);
            add_man(y + 1 + py2 + (FLY * j), x + 45 + (LCARLENGTH - 1) * j);
            add_man(y + 1 + py2 + (FLY * j), x + 53 + (LCARLENGTH - 1) * j);
        }
    }
    add_smoke(y - 1, x + LOGOFUNNEL);

    return OK;
}

int32_t add_C51(int32_t x, char* namelist[], int32_t cars)
{
    static char *c51[C51PATTERNS][C51HEIGHT + 1]
        = {{C51STR1, C51STR2, C51STR3, C51STR4, C51STR5, C51STR6, C51STR7,
            C51WH11, C51WH12, C51WH13, C51WH14, C51DEL},
           {C51STR1, C51STR2, C51STR3, C51STR4, C51STR5, C51STR6, C51STR7,
            C51WH21, C51WH22, C51WH23, C51WH24, C51DEL},
           {C51STR1, C51STR2, C51STR3, C51STR4, C51STR5, C51STR6, C51STR7,
            C51WH31, C51WH32, C51WH33, C51WH34, C51DEL},
           {C51STR1, C51STR2, C51STR3, C51STR4, C51STR5, C51STR6, C51STR7,
            C51WH41, C51WH42, C51WH43, C51WH44, C51DEL},
           {C51STR1, C51STR2, C51STR3, C51STR4, C51STR5, C51STR6, C51STR7,
            C51WH51, C51WH52, C51WH53, C51WH54, C51DEL},
           {C51STR1, C51STR2, C51STR3, C51STR4, C51STR5, C51STR6, C51STR7,
            C51WH61, C51WH62, C51WH63, C51WH64, C51DEL}};
    static char *coal[C51HEIGHT + 1]
        = {COALDEL, COAL01, COAL02, COAL03, COAL04, COAL05,
           COAL06, COAL07, COAL08, COAL09, COAL10, COALDEL};

    static char *car[C51HEIGHT + 1]
        = {COALDEL, CAR01, CAR02, CAR03, CAR04, CAR05,
           CAR06, CAR07, CAR08, CAR09, CAR10, COALDEL};

    int32_t y, i, j, pos, dy = 0;
    char carName[NAME_BUFFER];
    if (x < - (C51LENGTH + ((cars > 0) ? cars * (CARLENGTH - 1) : 0))) {
        return ERR;
    }

    y = LINES / 2 - 5;

    if (FLY == 1) {
        y = (x / 7) + LINES - (COLS / 7) - C51HEIGHT;
        if (y < (0 - (C51HEIGHT + 8))) {
            return ERR;
        }
        dy = 1;
    }

    for (i = 0; i <= C51HEIGHT; ++i) {
        my_mvaddstr(y + i, x, c51[(C51LENGTH + x) % C51PATTERNS][i]);
        my_mvaddstr(y + i + dy, x + 55, coal[i]);
        for (j = 0; j < cars; ++j) {
            pos = C51LENGTH + x + (CARLENGTH - 3) * (j + 1);
            if (pos < 0) {
                continue;
            } else if (pos > COLS + C51LENGTH) {
                break;
            }

            print_car(carName, sizeof(carName), car[i], namelist[j], 22);
            my_mvaddstr(y + i + (FLY * (j + 1)) + dy, x + 55 + (CARLENGTH - 3) * (j + 1), carName);
        }
    }

    if (ACCIDENT == 1) {
        if (x + 49 > 0) {
            add_man(y + 2, x + 45);
            add_man(y + 2, x + 49);
        }

        for (j = 0; j < cars; ++j) {
            pos = C51LENGTH + x + (CARLENGTH - 3) * (j + 1);
            if (pos < 0) {
                continue;
            } else if (pos > COLS + C51LENGTH) {
                break;
            }

            add_man(y + 2 + (FLY * (j + 2)), x + C51LENGTH + 3 + ((CARLENGTH - 3) * j));
            add_man(y + 2 + (FLY * (j + 2)), x + C51LENGTH + 13 + ((CARLENGTH - 3) * j));
        }
    }

    add_smoke(y - 1, x + C51FUNNEL);

    return OK;
}
