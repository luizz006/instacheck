// InstaCheck - Core Logic
let abortScan = false;
let currentUnfollowers = [];
let allFollowingList = [];
let allFollowersList = [];
let cachedFollowingData = null;

// DOM Elements
const controlSection = document.getElementById('control-section');
const progressSection = document.getElementById('progress-section');
const resultsSection = document.getElementById('results-section');

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnReset = document.getElementById('btn-reset');
const btnExport = document.getElementById('btn-export');

const delaySelect = document.getElementById('delay-select');
const errorMessage = document.getElementById('error-message');

const cacheBox = document.getElementById('cache-box');
const cacheCount = document.getElementById('cache-count');
const cacheDate = document.getElementById('cache-date');
const useCachedFollowing = document.getElementById('use-cached-following');

const progressStatus = document.getElementById('progress-status');
const progressCount = document.getElementById('progress-count');
const progressBarFill = document.getElementById('progress-bar-fill');

const statFollowing = document.getElementById('stat-following');
const statFollowers = document.getElementById('stat-followers');
const statUnfollowers = document.getElementById('stat-unfollowers');

const searchInput = document.getElementById('search-input');
const usersList = document.getElementById('users-list');

// Initialization: restore saved results and cached following
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await chrome.storage.local.get(['lastScan', 'cachedFollowing']);

    // Load following cache if available
    if (data && data.cachedFollowing && data.cachedFollowing.users) {
      cachedFollowingData = data.cachedFollowing;
      updateCacheUI(cachedFollowingData);
    } else if (data && data.lastScan && data.lastScan.following) {
      // Backward compatibility: build cache from lastScan
      cachedFollowingData = {
        timestamp: data.lastScan.timestamp || Date.now(),
        users: data.lastScan.following
      };
      updateCacheUI(cachedFollowingData);
    }

    // Load last scan results
    if (data && data.lastScan) {
      const { following, followers, unfollowers } = data.lastScan;
      if (unfollowers && unfollowers.length >= 0) {
        currentUnfollowers = unfollowers;
        showResults(following.length, followers.length, unfollowers);
      }
    }
  } catch (e) {
    console.warn('Unable to load saved data:', e);
  }
});

// Update or hide the cache UI box
function updateCacheUI(cache) {
  if (cache && cache.users && cache.users.length > 0) {
    cacheCount.textContent = `${cache.users.length} following cached`;
    const d = new Date(cache.timestamp || Date.now());
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    cacheDate.textContent = `Scanned on ${dateFormatted}`;
    cacheBox.classList.remove('hidden');
    useCachedFollowing.checked = true;
  } else {
    cacheBox.classList.add('hidden');
    useCachedFollowing.checked = false;
  }
}

// Event Listeners
btnStart.addEventListener('click', startScan);
btnStop.addEventListener('click', () => {
  abortScan = true;
  progressStatus.textContent = 'Stopping...';
});
btnReset.addEventListener('click', resetToHome);
searchInput.addEventListener('input', handleSearch);
btnExport.addEventListener('click', exportResults);

// Main scan function
async function startScan() {
  hideError();
  abortScan = false;

  const baseDelay = parseInt(delaySelect.value, 10) || 2000;

  // 1. Check if user is logged in
  const userId = await getLoggedInUserId();
  if (!userId) {
    showError(
      "You are not logged in to Instagram in this browser. " +
      "Please open <a href='https://www.instagram.com' target='_blank' style='color:#0095f6'>instagram.com</a>, " +
      "log in, and try again."
    );
    return;
  }

  const csrfToken = await getCsrfToken();

  // Change view: show progress
  controlSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  progressSection.classList.remove('hidden');

  try {
    const shouldUseCache = useCachedFollowing.checked && cachedFollowingData && cachedFollowingData.users?.length > 0;

    if (shouldUseCache) {
      allFollowingList = cachedFollowingData.users;
      updateProgress('Using cached following...', `${allFollowingList.length} following ready`, 20);
      await sleep(350);
    } else {
      // 2. Fetch Following list
      updateProgress('Fetching Following...', '0 following', 10);
      allFollowingList = await fetchList('following', userId, csrfToken, baseDelay, (count) => {
        updateProgress('Fetching Following...', `${count} following`, Math.min(45, 10 + Math.floor(count / 10)));
      });

      if (abortScan) {
        showError('Scan cancelled by user.');
        resetToHome();
        return;
      }

      // Update following cache
      cachedFollowingData = {
        timestamp: Date.now(),
        users: allFollowingList
      };
      await chrome.storage.local.set({ cachedFollowing: cachedFollowingData });
      updateCacheUI(cachedFollowingData);

      // Brief pause between both main fetches
      await sleep(baseDelay);
    }

    // 3. Fetch Followers list
    updateProgress('Fetching Followers...', '0 followers', 50);
    allFollowersList = await fetchList('followers', userId, csrfToken, baseDelay, (count) => {
      updateProgress('Fetching Followers...', `${count} followers`, Math.min(90, 50 + Math.floor(count / 10)));
    });

    if (abortScan) {
      showError('Scan cancelled by user.');
      resetToHome();
      return;
    }

    // 4. Calculate difference (not following back)
    updateProgress('Comparing lists...', '', 95);
    const followersSet = new Set(allFollowersList.map(u => String(u.pk || u.id || u.username)));
    currentUnfollowers = allFollowingList.filter(u => !followersSet.has(String(u.pk || u.id || u.username)));

    // Save to local storage so results persist if popup closes
    await chrome.storage.local.set({
      cachedFollowing: cachedFollowingData,
      lastScan: {
        timestamp: Date.now(),
        following: allFollowingList,
        followers: allFollowersList,
        unfollowers: currentUnfollowers
      }
    });

    // 5. Display results
    showResults(allFollowingList.length, allFollowersList.length, currentUnfollowers);

  } catch (err) {
    console.error(err);
    showError(err.message || 'An unexpected error occurred during the scan.');
    resetToHome();
  }
}

// Generic paginated fetch function using signed cursor (next_max_id)
async function fetchList(endpointType, userId, csrfToken, baseDelay, onProgress) {
  let cursor = null;
  const list = [];

  do {
    if (abortScan) break;

    let url = `https://www.instagram.com/api/v1/friendships/${userId}/${endpointType}/?count=50`;
    if (cursor) {
      url += `&max_id=${encodeURIComponent(cursor)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrfToken || '',
        'Accept': '*/*'
      },
      credentials: 'include'
    });

    if (response.status === 429) {
      throw new Error("Instagram returned a temporary rate limit (HTTP 429). Please wait a few minutes before trying again.");
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} from Instagram while fetching ${endpointType}.`);
    }

    const data = await response.json();
    if (!data.users || !Array.isArray(data.users)) {
      throw new Error("Invalid response format received from Instagram.");
    }

    list.push(...data.users);
    cursor = data.next_max_id || null;

    onProgress(list.length);

    if (cursor && !abortScan) {
      await sleep(baseDelay);
    }
  } while (cursor && !abortScan);

  return list;
}

// Cookie Helpers
async function getLoggedInUserId() {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://www.instagram.com',
      name: 'ds_user_id'
    });
    return cookie ? cookie.value : null;
  } catch (e) {
    console.error("Error reading ds_user_id cookie:", e);
    return null;
  }
}

async function getCsrfToken() {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://www.instagram.com',
      name: 'csrftoken'
    });
    return cookie ? cookie.value : '';
  } catch (e) {
    return '';
  }
}

// Throttling utility with random anti-bot jitter
function sleep(ms) {
  const jitter = Math.floor(Math.random() * 500); // random extra delay between 0 and 500ms
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

// Progress UI update
function updateProgress(status, countText, percent) {
  progressStatus.textContent = status;
  progressCount.textContent = countText;
  progressBarFill.style.width = `${Math.min(100, percent)}%`;
}

// Display results screen
function showResults(countFollowing, countFollowers, unfollowers) {
  progressSection.classList.add('hidden');
  controlSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');

  statFollowing.textContent = countFollowing;
  statFollowers.textContent = countFollowers;
  statUnfollowers.textContent = unfollowers.length;

  renderUsersList(unfollowers);
}

// Render list of users not following back
function renderUsersList(users) {
  usersList.innerHTML = '';

  if (users.length === 0) {
    usersList.innerHTML = `
      <li style="text-align:center; padding: 24px 8px; color: #a0a0a0; font-size: 13px;">
        🎉 Great news! Everyone you follow is following you back.
      </li>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23777'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

  users.forEach(user => {
    const li = document.createElement('li');
    li.className = 'user-item';

    const avatarUrl = user.profile_pic_url || DEFAULT_AVATAR;
    const username = user.username || 'unknown';
    const fullName = user.full_name || '';

    li.innerHTML = `
      <div class="user-info-wrapper">
        <img class="user-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(username)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'" />
        <div class="user-names">
          <a href="https://www.instagram.com/${encodeURIComponent(username)}/" target="_blank" class="user-username">@${escapeHtml(username)}</a>
          <span class="user-fullname">${escapeHtml(fullName)}</span>
        </div>
      </div>
      <a href="https://www.instagram.com/${encodeURIComponent(username)}/" target="_blank" class="btn-profile-link">View</a>
    `;

    fragment.appendChild(li);
  });

  usersList.appendChild(fragment);
}

// Live search filter
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderUsersList(currentUnfollowers);
    return;
  }

  const filtered = currentUnfollowers.filter(u => {
    const username = (u.username || '').toLowerCase();
    const fullName = (u.full_name || '').toLowerCase();
    return username.includes(query) || fullName.includes(query);
  });

  renderUsersList(filtered);
}

// Export list to CSV file
function exportResults() {
  if (!currentUnfollowers || currentUnfollowers.length === 0) {
    alert("No users to export.");
    return;
  }

  let content = "Username,Full Name,Profile URL\n";
  currentUnfollowers.forEach(u => {
    content += `"${u.username}","${(u.full_name || '').replace(/"/g, '""')}","https://www.instagram.com/${u.username}/"\n`;
  });

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `instacheck_not_following_back_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Reset to initial screen
function resetToHome() {
  progressSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  controlSection.classList.remove('hidden');
  progressBarFill.style.width = '0%';
  if (cachedFollowingData) {
    updateCacheUI(cachedFollowingData);
  }
}

// Error presentation
function showError(msg) {
  errorMessage.innerHTML = msg;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.innerHTML = '';
  errorMessage.classList.add('hidden');
}

// HTML escape helper
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
