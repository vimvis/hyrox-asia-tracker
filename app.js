let rawData = [];
let selectedLocations = new Set();

// DOM Elements
const locationTagsContainer = document.getElementById('location-tags');
const selectDivision = document.getElementById('division');
const selectGender = document.getElementById('gender');
const selectAge = document.getElementById('age');
const tableBody = document.getElementById('table-body');
const resultCount = document.getElementById('result-count');
const loadingState = document.getElementById('loading');
const tableContainer = document.querySelector('.table-container');

// Time parser for sorting (MM:SS)
function parseTimeToSeconds(timeStr) {
    if (!timeStr || timeStr === "N/A") return Infinity;
    const parts = String(timeStr).split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return parseFloat(timeStr) || Infinity;
}

// Initialization function
async function loadData() {
    try {
        const response = await fetch('hyrox_data.json');
        rawData = await response.json();
        
        // Clean some data if necessary
        rawData.forEach(item => {
            item.seconds = parseTimeToSeconds(item.total_time);
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

// Populate dropdowns with unique values
function populateFilters() {
    const locations = [...new Set(rawData.map(d => d.event_location))].sort();
    const divisions = [...new Set(rawData.map(d => d.division))].sort();
    const genders = [...new Set(rawData.map(d => d.gender))].sort();
    const ages = [...new Set(rawData.map(d => d.ageGroup))].sort();

    const createOptions = (arr, element) => {
        arr.forEach(val => {
            if(!val) return;
            const option = document.createElement('option');
            option.value = val;
            option.textContent = val;
            element.appendChild(option);
        });
    };
    // Render Location Tags
    locationTagsContainer.innerHTML = '';
    const allTag = document.createElement('div');
    allTag.className = 'tag active';
    allTag.textContent = 'All Locations';
    allTag.dataset.val = 'All';
    allTag.addEventListener('click', () => toggleLocation('All', allTag));
    locationTagsContainer.appendChild(allTag);

    locations.forEach(loc => {
        if(!loc) return;
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = loc;
        tag.dataset.val = loc;
        tag.addEventListener('click', () => toggleLocation(loc, tag));
        locationTagsContainer.appendChild(tag);
    });

    createOptions(divisions, selectDivision);
    createOptions(genders, selectGender);
    createOptions(ages, selectAge);
    
    // Auto-select first division and gender to avoid displaying 26k rows at once
    if (divisions.length > 0) selectDivision.value = divisions[0];
    if (genders.length > 0) selectGender.value = genders[0];
}

function toggleLocation(val, element) {
    if (val === 'All') {
        selectedLocations.clear();
        Array.from(locationTagsContainer.children).forEach(tag => tag.classList.remove('active'));
        element.classList.add('active');
    } else {
        // Remove All Locations active state
        locationTagsContainer.children[0].classList.remove('active');
        
        if (selectedLocations.has(val)) {
            selectedLocations.delete(val);
            element.classList.remove('active');
        } else {
            selectedLocations.add(val);
            element.classList.add('active');
        }
        
        // If none selected, revert to All Locations
        if (selectedLocations.size === 0) {
            locationTagsContainer.children[0].classList.add('active');
        }
    }
    renderTable();
}

// Render data based on filters
function renderTable() {
    const divFilter = selectDivision.value;
    const genFilter = selectGender.value;
    const ageFilter = selectAge.value;

    let filtered = rawData.filter(d => {
        const matchesLoc = selectedLocations.size === 0 || selectedLocations.has(d.event_location);
        return matchesLoc &&
               (divFilter === 'All' || d.division === divFilter) &&
               (genFilter === 'All' || d.gender === genFilter) &&
               (ageFilter === 'All' || d.ageGroup === ageFilter);
    });

    // Sort by time
    filtered.sort((a, b) => a.seconds - b.seconds);

    // Render HTML
    tableBody.innerHTML = '';
    
    // Performance optimization: Render top 500 if unconstrained
    const displayData = filtered.slice(0, 500); 

    displayData.forEach((row, index) => {
        const rank = index + 1;
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><span class="metric-rank">${rank}</span></td>
            <td style="font-weight:600">${row.name || 'N/A'}</td>
            <td>${row.nationality || 'N/A'}</td>
            <td>${row.event_location} (S${row.season_no})</td>
            <td>${row.division}</td>
            <td>${row.ageGroup}</td>
            <td class="metric-time">${row.total_time}</td>
        `;
        tableBody.appendChild(tr);
    });

    resultCount.textContent = `${filtered.length} athletes found ${filtered.length > 500 ? '(showing top 500)' : ''}`;
}

// Event Listeners
selectDivision.addEventListener('change', renderTable);
selectGender.addEventListener('change', renderTable);
selectAge.addEventListener('change', renderTable);

// Start
document.addEventListener('DOMContentLoaded', loadData);
