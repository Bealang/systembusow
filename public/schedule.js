// ============================================================================
// MLECZEK BUS - Schedule & Departures Module (schedule.js)
// Handles schedule loading, next departures calculation, and full view modal
// ============================================================================

(function() {
    let currentScheduleData = null;

    function getDayType(date) {
        const day = date.getDay();
        if (day === 0) return 'sunday';
        if (day === 6) return 'saturday';
        return 'workdays';
    }

    function getDayName(date) {
        const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
        return days[date.getDay()];
    }

    function formatNotes(notesArray) {
        if (!notesArray || notesArray.length === 0) return "";

        return notesArray.map(n => {
            let span = `<span class="note-badge">${n}</span>`;
            if (window.NOTE_DESCRIPTIONS && window.NOTE_DESCRIPTIONS[n]) {
                span += ` <span style="font-size: 0.85em;">(${window.NOTE_DESCRIPTIONS[n]})</span>`;
            }
            return span;
        }).join(", ");
    }

    function getDepartureDate(timeStr, baseDate) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const depDate = new Date(baseDate);
        depDate.setHours(hours, minutes, 0, 0);
        return depDate;
    }

    function getNextDepartures(citySchedule, currentDate) {
        if (!citySchedule) return null;
        let checkDate = new Date(currentDate);
        let currentMins = checkDate.getHours() * 60 + checkDate.getMinutes();
        
        // We also check for courses that departed up to 1 minute ago to show "Właśnie odjechał"
        // so we adjust currentMins slightly down by 1 minute for the initial check on today
        let checkMinsToday = currentMins - 1;

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            let dayType = getDayType(checkDate);
            let scheduleForDay = citySchedule[dayType];

            if (scheduleForDay && scheduleForDay.length > 0) {
                for (let i = 0; i < scheduleForDay.length; i++) {
                    let departure = scheduleForDay[i];
                    let departureMins = window.timeToMinutes(departure.time);

                    const isTargetTime = dayOffset > 0 || departureMins >= checkMinsToday;

                    if (isTargetTime) {
                        const departureDate = getDepartureDate(departure.time, checkDate);
                        
                        let nextFollowing = null;
                        let followingDate = null;
                        if (i + 1 < scheduleForDay.length) {
                            nextFollowing = scheduleForDay[i + 1];
                            followingDate = getDepartureDate(nextFollowing.time, checkDate);
                        } else {
                            let nextDayDate = new Date(checkDate);
                            for (let nextOffset = 1; nextOffset < 7; nextOffset++) {
                                nextDayDate.setDate(nextDayDate.getDate() + 1);
                                let nextDayType = getDayType(nextDayDate);
                                if (citySchedule[nextDayType] && citySchedule[nextDayType].length > 0) {
                                    nextFollowing = citySchedule[nextDayType][0];
                                    followingDate = getDepartureDate(nextFollowing.time, nextDayDate);
                                    break;
                                }
                            }
                        }

                        return {
                            next: departure,
                            nextDate: departureDate,
                            following: nextFollowing,
                            followingDate: followingDate,
                            isToday: dayOffset === 0,
                            dayName: getDayName(checkDate)
                        };
                    }
                }
            }
            checkDate.setDate(checkDate.getDate() + 1);
            checkMinsToday = 0; // Reset for subsequent days
        }
        return null;
    }

    function formatTimeDiff(diffMs, departureDate, currentDate) {
        const diffSecs = Math.round(diffMs / 1000);
        
        // Poniżej minuty temu (właśnie odjechał)
        if (diffSecs < 0 && diffSecs >= -60) {
            return { main: "Właśnie odjechał", showTime: true };
        }
        
        if (diffSecs <= 0) {
            return { main: "odjechał", showTime: false };
        }

        // Sprawdzamy czy to ten sam dzień kalendarzowy
        const isSameDay = departureDate.getDate() === currentDate.getDate() &&
                          departureDate.getMonth() === currentDate.getMonth() &&
                          departureDate.getFullYear() === currentDate.getFullYear();

        if (isSameDay) {
            const diffMins = Math.floor(diffSecs / 60);

            if (diffMins === 0) {
                return { main: "za chwilę", showTime: true };
            }

            if (diffMins < 60) {
                return { main: `za ${diffMins} min`, showTime: true };
            }

            const diffHours = Math.floor(diffMins / 60);
            const remainingMins = diffMins % 60;
            const minsStr = remainingMins > 0 ? ` ${remainingMins} min` : "";
            return { main: `za ${diffHours} godz.${minsStr}`, showTime: true };
        }

        // Sprawdzamy czy to jutro (kolejny dzień kalendarzowy)
        const tomorrow = new Date(currentDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = departureDate.getDate() === tomorrow.getDate() &&
                           departureDate.getMonth() === tomorrow.getMonth() &&
                           departureDate.getFullYear() === tomorrow.getFullYear();

        if (isTomorrow) {
            return { main: "Jutro", showTime: true };
        }

        // W przeciwnym razie obliczamy dni kalendarzowe
        const currentZero = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const departureZero = new Date(departureDate.getFullYear(), departureDate.getMonth(), departureDate.getDate());
        const diffDays = Math.round((departureZero - currentZero) / (1000 * 60 * 60 * 24));

        return { main: `za ${diffDays} dni`, showTime: true };
    }

    function formatFooterInfo(following, followingDate, now) {
        if (!following || !followingDate) return "Następny: --:--";
        const diffMs = followingDate.getTime() - now.getTime();
        const countdownInfo = formatTimeDiff(diffMs, followingDate, now);
        return `Następny: ${following.time} (${countdownInfo.main})`;
    }

    function updateDisplays() {
        if (!currentScheduleData) return;

        const now = new Date();

        // miejscowosc2 Update
        const mysleniceDeps = getNextDepartures(currentScheduleData.myslenice, now);
        const mTime = document.getElementById('next-myslenice-time');
        const mNotes = document.getElementById('next-myslenice-notes');
        const mFollow = document.getElementById('following-myslenice-info');

        if (mysleniceDeps) {
            if (mTime) {
                const diffMs = mysleniceDeps.nextDate.getTime() - now.getTime();
                const timeInfo = formatTimeDiff(diffMs, mysleniceDeps.nextDate, now);
                mTime.innerHTML = `
                    <div class="time-countdown">${timeInfo.main}</div>
                    ${timeInfo.showTime ? `<div class="time-sub-hour">odjazd o ${mysleniceDeps.next.time}</div>` : ''}
                `;
            }
            if (mNotes) mNotes.innerHTML = formatNotes(mysleniceDeps.next.notes);
            if (mFollow) {
                mFollow.textContent = formatFooterInfo(mysleniceDeps.following, mysleniceDeps.followingDate, now);
            }
        } else {
            if (mTime) mTime.innerHTML = '<div class="time-countdown">--:--</div>';
            if (mNotes) mNotes.textContent = "Brak kursów";
            if (mFollow) mFollow.textContent = "Następny: --:--";
        }

        // miejscowosc1 Update
        const sulkowiceDeps = getNextDepartures(currentScheduleData.sulkowice, now);
        const sTime = document.getElementById('next-sulkowice-time');
        const sNotes = document.getElementById('next-sulkowice-notes');
        const sFollow = document.getElementById('following-sulkowice-info');

        if (sulkowiceDeps) {
            if (sTime) {
                const diffMs = sulkowiceDeps.nextDate.getTime() - now.getTime();
                const timeInfo = formatTimeDiff(diffMs, sulkowiceDeps.nextDate, now);
                sTime.innerHTML = `
                    <div class="time-countdown">${timeInfo.main}</div>
                    ${timeInfo.showTime ? `<div class="time-sub-hour">odjazd o ${sulkowiceDeps.next.time}</div>` : ''}
                `;
            }
            if (sNotes) sNotes.innerHTML = formatNotes(sulkowiceDeps.next.notes);
            if (sFollow) {
                sFollow.textContent = formatFooterInfo(sulkowiceDeps.following, sulkowiceDeps.followingDate, now);
            }
        } else {
            if (sTime) sTime.innerHTML = '<div class="time-countdown">--:--</div>';
            if (sNotes) sNotes.textContent = "Brak kursów";
            if (sFollow) sFollow.textContent = "Następny: --:--";
        }
    }

    async function fetchAttributes() {
        try {
            const res = await fetch('/api/attributes');
            const attributes = await res.json();
            
            window.NOTE_DESCRIPTIONS = {};
            attributes.forEach(attr => {
                window.NOTE_DESCRIPTIONS[attr.symbol] = attr.description;
            });
            
            const legendList = document.getElementById('legend-dynamic-list');
            if (legendList) {
                legendList.innerHTML = '';
                attributes.forEach(attr => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span class="badge">${attr.symbol}</span> - ${attr.description}`;
                    legendList.appendChild(li);
                });
            }
        } catch (e) {
            console.error("Failed to load attributes", e);
        }
    }

    async function fetchSchedule() {
        try {
            const res = await fetch('/api/schedule');
            const data = await res.json();
            currentScheduleData = data;
            requestAnimationFrame(updateDisplays);
        } catch (error) {
            console.error("Error fetching schedule:", error);
            const mNotes = document.getElementById('next-myslenice-notes');
            const sNotes = document.getElementById('next-sulkowice-notes');
            if (mNotes) mNotes.textContent = "Błąd pobierania danych";
            if (sNotes) sNotes.textContent = "Błąd pobierania danych";
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        const nextMysleniceTimeEl = document.getElementById('next-myslenice-time');
        const nextSulkowiceTimeEl = document.getElementById('next-sulkowice-time');

        // Only activate if schedule elements are in DOM
        if (!nextMysleniceTimeEl && !nextSulkowiceTimeEl) return;

        fetchAttributes().then(() => {
            fetchSchedule();
        });

        // Auto-refresh departures every 10s (seconds removed)
        setInterval(() => {
            requestAnimationFrame(updateDisplays);
        }, 10000);

        // Zoom Modal Setup
        const modal = document.getElementById('schedule-modal');
        const btnShowModal = document.getElementById('btn-show-modal');
        const btnCloseModal = document.getElementById('modal-close');

        if (btnShowModal && modal && btnCloseModal) {
            btnShowModal.addEventListener('click', () => {
                const modalImg = modal.querySelector('.modal-image');
                if (modalImg) {
                    modalImg.src = '/rozklad-current?v=' + new Date().getTime();
                }
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            });

            const closeModal = () => {
                modal.classList.remove('active');
                document.body.style.overflow = 'auto';
            };

            btnCloseModal.addEventListener('click', closeModal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('active')) {
                    closeModal();
                }
            });
        }
    });
})();
