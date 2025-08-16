document.addEventListener("DOMContentLoaded", () => {
    console.log("charts.js loaded");
    if (window.chartsLoaded) {
        console.log("Charts already loaded, skipping");
        return;
    }
    window.chartsLoaded = true;

    // Google Apps Script Web app URL with CORS proxy
    const apiUrl = 'js/data.json';

    fetch(apiUrl)
        .then(response => {
            console.log("Fetching API: Status", response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Data loaded:", data);
            if (data.error) {
                throw new Error(data.error);
            }
            document.getElementById("totalBalance").textContent = `Total Balance: KES ${data.total_balance.toFixed(2)}`;
            console.log("Total Balance set");
            try {
                const pieCanvas = document.getElementById("memberPieChart");
                if (pieCanvas.chart) {
                    pieCanvas.chart.destroy();
                }
                pieCanvas.chart = new Chart(pieCanvas, {
                    type: "pie",
                    data: {
                        labels: data.member_contributions.map(item => item.member_name),
                        datasets: [{
                            label: "Member Contributions (KES)",
                            data: data.member_contributions.map(item => item.amount),
                            backgroundColor: ["#1a73e8", "#34c759", "#4285f4", "#ffd700", "#ff6f61", "#6b7280", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"],
                            borderColor: "#ffffff",
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: "top", labels: { font: { size: 12, family: "'Roboto', Arial, sans-serif" }, color: "#2c3e50" } },
                            tooltip: { callbacks: { label: context => `${context.label}: KES ${context.raw.toFixed(2)}` } }
                        }
                    }
                });
                console.log("Pie Chart rendered");
            } catch (error) {
                console.error("Pie Chart error:", error);
            }
            try {
                const barCanvas = document.getElementById("inflowsOutflowsChart");
                if (barCanvas.chart) {
                    barCanvas.chart.destroy();
                }
                barCanvas.chart = new Chart(barCanvas, {
                    type: "bar",
                    data: {
                        labels: ["Inflows", "Outflows"],
                        datasets: [{
                            label: "Amount (KES)",
                            data: [data.inflows, data.outflows],
                            backgroundColor: ["#1a73e8", "#e74c3c"],
                            borderColor: ["#ffffff", "#ffffff"],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: "Amount (KES)", color: "#2c3e50", font: { size: 12, family: "'Roboto', Arial, sans-serif" } }, ticks: { color: "#2c3e50", callback: value => `KES ${value.toFixed(2)}` } },
                            x: { ticks: { color: "#2c3e50", font: { size: 12, family: "'Roboto', Arial, sans-serif" } } }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: context => `${context.label}: KES ${context.raw.toFixed(2)}` } }
                        }
                    }
                });
                console.log("Bar Chart rendered");
            } catch (error) {
                console.error("Bar Chart error:", error);
            }
            try {
                const searchForm = document.getElementById("searchForm");
                const searchInput = document.getElementById("memberName");
                const searchResult = document.getElementById("searchResult");
                searchForm.addEventListener("submit", e => {
                    e.preventDefault();
                    const searchTerm = searchInput.value.trim().toLowerCase();
                    if (!searchTerm) {
                        searchResult.textContent = "Please enter a member name.";
                        searchResult.style.color = "#e74c3c";
                        return;
                    }
                    const member = data.member_contributions.find(item => item.member_name.toLowerCase().includes(searchTerm));
                    if (member) {
                        searchResult.innerHTML = `
                            <strong>Name:</strong> ${member.member_name}<br>
                            <strong>Contribution:</strong> KES ${member.amount.toFixed(2)}<br>
                            <strong>Shares:</strong> ${member.shares}<br>
                            <strong>Last Contribution:</strong> ${new Date(member.last_contribution_date).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric"
                            })}
                        `;
                        searchResult.style.color = "#2c3e50";
                    } else {
                        searchResult.textContent = "No member found.";
                        searchResult.style.color = "#e74c3c";
                    }
                });
                console.log("Search functionality added");
            } catch (error) {
                console.error("Search error:", error);
            }
        })
        .catch(error => {
            console.error("[i-8 SMART BOT] Error:", error);
            document.getElementById("totalBalance").textContent = "Error loading data.";
            document.getElementById("searchResult").textContent = "Error loading member data.";
            document.getElementById("searchResult").style.color = "#e74c3c";
        });
});