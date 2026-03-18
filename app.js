let rawData = [];
let selectedLocations = new Set();
let selectedAthletes = new Map(); // for comparison {index -> data}
let currentChart = null;

// DOM Elements
const locationTagsContainer = document.getElementById('location-tags');
const selectDivision = document.getElementById('division');
const selectGender = document.getElementById('gender');
const selectAge = document.getElementById('age');
const searchInput = document.getElementById('search-input');

const tableBody = document.getElementById('table-body');
const resultCount = document.getElementById('result-count');
const loadingState = document.getElementById('loading');
const tableContainer = document.querySelector('.table-container');

// Modal & Compare Elements
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const chartCanvas = document.getElementById('chart-canvas');
const compareBar = document.getElementById('compare-bar');
const compareCountTxt = document.getElementById('compare-count');
const btnCompare = document.getElementById('btn-compare');
const btnStats = document.getElementById('btn-stats');

// Format minutes (float) into MM:SS string
function formatTimeStr(minutesFloat) {
    if (!minutesFloat || isNaN(minutesFloat)) return "N/A";
    const mins = Math.floor(minutesFloat);
    const secs = Math.floor((minutesFloat - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Initial load
async function loadData() {
    try {
        const response = await fetch('hyrox_data.json');
        rawData = await response.json();
        
        // Add exact row id locally
        rawData.forEach((item, i) => {
            item._id = i;
            item.seconds = parseFloat(item.total_time) * 60 || Infinity;
        });

        populateFilters();
        renderTable();
        
        loadingState.classList.add('hidden');
        tableContainer.classList.remove('hidden');
        
    } catch (error) {
        console.error("Error loading data:", error);
        loadingState.innerHTML = "<p>Error loading data. Make sure hyrox_data.json is present.</p>";
    }
}

// Build Filters
function populateFilters() {
    const locations = [...new Set(rawData.map(d => d.event_location))].sort();
    const divisions = [...new Set(rawData.map(d => d.division))].sort();
    const genders = [...new Set(rawData.map(d => d.gender))].sort();
    const ages = [...new Set(rawData.map(d => d.ageGroup))].sort();

    // Render Location Tags
    locationTagsContainer.innerHTML = '';
    const allTag = document.createElement('div');
    allTag.className = 'tag active';
    allTag.textContent = 'All Locations';
    allTag.addEventListener('click', () => toggleLocation('All', allTag));
    locationTagsContainer.appendChild(allTag);

    locations.forEach(loc => {
        if(!loc) return;
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = loc;
        tag.addEventListener('click', () => toggleLocation(loc, tag));
        locationTagsContainer.appendChild(tag);
    });

    const createOptions = (arr, element) => {
        arr.forEach(val => {
            if(!val) return;
            const option = document.createElement('option');
            option.value = val;
            option.textContent = val;
            element.appendChild(option);
        });
    };

    createOptions(divisions, selectDivision);
    createOptions(genders, selectGender);
    createOptions(ages, selectAge);
    
    if (divisions.length > 0) selectDivision.value = divisions[0];
    if (genders.length > 0) selectGender.value = genders[0];
}

function toggleLocation(val, element) {
    if (val === 'All') {
        selectedLocations.clear();
        Array.from(locationTagsContainer.children).forEach(tag => tag.classList.remove('active'));
        element.classList.add('active');
    } else {
        locationTagsContainer.children[0].classList.remove('active');
        if (selectedLocations.has(val)) {
            selectedLocations.delete(val);
            element.classList.remove('active');
        } else {
            selectedLocations.add(val);
            element.classList.add('active');
        }
        if (selectedLocations.size === 0) {
            locationTagsContainer.children[0].classList.add('active');
        }
    }
    renderTable();
}

function getFilteredData() {
    const divFilter = selectDivision.value;
    const genFilter = selectGender.value;
    const ageFilter = selectAge.value;
    const query = searchInput.value.trim().toLowerCase();

    return rawData.filter(d => {
        const matchesLoc = selectedLocations.size === 0 || selectedLocations.has(d.event_location);
        const matchesName = query ? String(d.name).toLowerCase().includes(query) : true;
        
        return matchesLoc && matchesName &&
               (divFilter === 'All' || d.division === divFilter) &&
               (genFilter === 'All' || d.gender === genFilter) &&
               (ageFilter === 'All' || d.ageGroup === ageFilter);
    });
}

function renderTable() {
    let filtered = getFilteredData();
    filtered.sort((a, b) => a.seconds - b.seconds); // Sort by time

    tableBody.innerHTML = '';
    const displayData = filtered.slice(0, 500); 

    displayData.forEach((row, index) => {
        const rank = index + 1;
        const tr = document.createElement('tr');
        tr.className = 'clickable';
        tr.onclick = () => viewProfile(row);
        
        const isChecked = selectedAthletes.has(row._id) ? 'checked' : '';
        
        tr.innerHTML = `
            <td class="checkbox-col" onclick="event.stopPropagation()">
                <input type="checkbox" class="athlete-cb" data-id="${row._id}" ${isChecked}>
            </td>
            <td><span class="metric-rank">${rank}</span></td>
            <td style="font-weight:600">${row.name || 'N/A'}</td>
            <td>${row.nationality || '-'}</td>
            <td>${row.event_location}</td>
            <td>${row.division}</td>
            <td>${row.ageGroup}</td>
            <td class="metric-time">${formatTimeStr(row.total_time)}</td>
        `;
        
        const cb = tr.querySelector('.athlete-cb');
        cb.addEventListener('change', (e) => toggleCompare(row, e.target.checked));
        
        tableBody.appendChild(tr);
    });

    resultCount.textContent = `${filtered.length} athletes found ${filtered.length > 500 ? '(showing top 500)' : ''}`;
}

// Search debounce
let timeout = null;
searchInput.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(renderTable, 300);
});

// Compare Checkbox Logic
function toggleCompare(athlete, isChecked) {
    if (isChecked) {
        if(selectedAthletes.size >= 5) {
            alert('You can only compare up to 5 athletes at once.');
            renderTable(); // Re-render to uncheck
            return;
        }
        selectedAthletes.set(athlete._id, athlete);
    } else {
        selectedAthletes.delete(athlete._id);
    }
    
    if (selectedAthletes.size > 0) {
        compareBar.classList.remove('hidden');
        compareCountTxt.textContent = `${selectedAthletes.size} selected`;
    } else {
        compareBar.classList.add('hidden');
    }
}

/* ========================================================= */
/* CHART.JS LOGIC */
/* ========================================================= */

// Chart setup config
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = 'Outfit';

function openModal() {
    modalOverlay.classList.remove('hidden');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    if (currentChart) currentChart.destroy();
}
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if(e.target === modalOverlay) closeModal();
});

// 1. Athlete Individual Profile (Bar Chart for Splits)
const SPLIT_KEYS = [
    {key:'run1_time', label:'Run 1'}, {key:'skiErg_time', label:'SkiErg'},
    {key:'run2_time', label:'Run 2'}, {key:'sledPush_time', label:'Sled Push'},
    {key:'run3_time', label:'Run 3'}, {key:'sledPull_time', label:'Sled Pull'},
    {key:'run4_time', label:'Run 4'}, {key:'burpeeBroadJump_time', label:'Burpees'},
    {key:'run5_time', label:'Run 5'}, {key:'rowErg_time', label:'RowErg'},
    {key:'run6_time', label:'Run 6'}, {key:'farmersCarry_time', label:'Farmers Carry'},
    {key:'run7_time', label:'Run 7'}, {key:'sandbagLunges_time', label:'Lunges'},
    {key:'run8_time', label:'Run 8'}, {key:'wallBalls_time', label:'Wall Balls'}
];

function viewProfile(athlete) {
    openModal();
    const data = SPLIT_KEYS.map(s => athlete[s.key] || 0); // floats in mins
    const labels = SPLIT_KEYS.map(s => s.label);
    
    if (currentChart) currentChart.destroy();
    currentChart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: athlete.name + ' - Split Times (Minutes)',
                data: data,
                backgroundColor: 'rgba(250, 204, 21, 0.7)',
                borderColor: '#facc15',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: { callbacks: { label: c => formatTimeStr(c.raw) } }
            },
            scales: {
                y: { beginAtZero: true, title: {display: true, text: 'Minutes'} }
            }
        }
    });
}

// 2. Compare Radar Chart
btnCompare.addEventListener('click', () => {
    if(selectedAthletes.size < 1) return;
    openModal();
    
    const labels = SPLIT_KEYS.map(s => s.label);
    const datasets = [];
    const colors = [
        'rgba(250, 204, 21, 0.6)', 'rgba(56, 189, 248, 0.6)', 'rgba(244, 63, 94, 0.6)', 
        'rgba(168, 85, 247, 0.6)', 'rgba(34, 197, 94, 0.6)'
    ];
    const borderColors = ['#facc15', '#38bdf8', '#f43f5e', '#a855f7', '#22c55e'];
    
    let i = 0;
    selectedAthletes.forEach((athlete) => {
        datasets.push({
            label: athlete.name,
            data: SPLIT_KEYS.map(s => athlete[s.key] || 0),
            backgroundColor: colors[i],
            borderColor: borderColors[i],
            borderWidth: 2,
            pointBackgroundColor: borderColors[i]
        });
        i++;
    });

    if (currentChart) currentChart.destroy();
    currentChart = new Chart(chartCanvas, {
        type: 'radar',
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: {
                tooltip: { callbacks: { label: c => c.dataset.label + ': ' + formatTimeStr(c.raw) } }
            },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#94a3b8', backdropColor: 'transparent' }
                }
            }
        }
    });
});

// 3. View Distribution Stats
btnStats.addEventListener('click', () => {
    const filtered = getFilteredData();
    if(filtered.length === 0) return;
    
    // Create Histogram Buckets (every 5 mins)
    const times = filtered.map(d => Number(d.total_time)).filter(v => !isNaN(v) && v > 0);
    if(times.length === 0) return;
    
    const min = Math.floor(Math.min(...times) / 5) * 5;
    const max = Math.ceil(Math.max(...times) / 5) * 5;
    
    let buckets = {};
    for (let i = min; i <= max; i += 5) buckets[i] = 0;
    times.forEach(t => {
        let b = Math.floor(t / 5) * 5;
        if(buckets[b] !== undefined) buckets[b]++;
    });
    
    const labels = Object.keys(buckets).map(k => `${k}-${parseInt(k)+5}m`);
    const data = Object.values(buckets);

    openModal();
    if (currentChart) currentChart.destroy();
    
    currentChart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Athletes (Current Filter)',
                data: data,
                backgroundColor: 'rgba(56, 189, 248, 0.4)',
                borderColor: '#38bdf8',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
});

// Setup Events
selectDivision.addEventListener('change', renderTable);
selectGender.addEventListener('change', renderTable);
selectAge.addEventListener('change', renderTable);

document.addEventListener('DOMContentLoaded', loadData);
