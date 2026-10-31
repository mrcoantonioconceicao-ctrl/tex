//! Catálogo de investigações lido do PostgreSQL (experiments e experiment_files,
//! migrações 0002 e 0003). Fica fora do domínio: o domínio só recebe a lista e
//! aplica search/find (domain/combustion/catalog.rs).
//!
//! Datas e instantes saem do SQL já em texto (to_char), no formato do contrato,
//! para não depender da feature chrono do sqlx.

use std::collections::HashMap;

use sqlx::postgres::{PgConnection, PgPool, PgRow};
use sqlx::Row;
use thiserror::Error;

use crate::domain::combustion::psi_dto::{
    Investigation, InvestigationFile, InvestigationSummary, Program, ProjectType,
};
use crate::lineage::OriginCategory;

/// Ordem do contrato: número do código PSI, crescente (PSI-99 antes de PSI-100)
const INVESTIGATIONS_SQL: &str = r#"
SELECT experiment_id, psi_accession, name, title, program, project_type,
       sub_research_area, hardware, psi_version, objective, approach, hypothesis,
       doi, license, total_file_bytes, origin_category,
       to_char(start_date, 'YYYY-MM-DD') AS start_date,
       to_char(end_date, 'YYYY-MM-DD') AS end_date,
       to_char(ingested_at AT TIME ZONE 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ingested_at
  FROM experiments
 WHERE psi_accession IS NOT NULL
 ORDER BY substring(psi_accession FROM 5)::numeric
"#;

const FILES_SQL: &str = r#"
SELECT f.experiment_id, f.category, f.file_name, f.file_bytes, f.sha256,
       to_char(f.downloaded_at AT TIME ZONE 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS downloaded_at
  FROM experiment_files f
  JOIN experiments e USING (experiment_id)
 WHERE e.psi_accession IS NOT NULL
 ORDER BY f.experiment_id, f.file_name
"#;

#[derive(Debug, Error)]
pub enum CatalogDbError {
    #[error("consulta do catálogo falhou: {0}")]
    Query(#[from] sqlx::Error),
    #[error("{record}: {field} fora do contrato ({value})")]
    InvalidRow {
        record: String,
        field: &'static str,
        value: String,
    },
}

pub async fn load_from_pool(pool: &PgPool) -> Result<Vec<Investigation>, CatalogDbError> {
    let mut conn = pool.acquire().await?;
    load_investigations(&mut conn).await
}

/// Todas as investigações com psi_accession, cada uma com os seus arquivos
pub async fn load_investigations(
    conn: &mut PgConnection,
) -> Result<Vec<Investigation>, CatalogDbError> {
    let rows = sqlx::query(INVESTIGATIONS_SQL)
        .fetch_all(&mut *conn)
        .await?;
    let file_rows = sqlx::query(FILES_SQL).fetch_all(&mut *conn).await?;
    let mut files = group_files(&file_rows)?;
    rows.iter()
        .map(|row| {
            let id: i64 = row.try_get("experiment_id")?;
            to_investigation(row, files.remove(&id).unwrap_or_default())
        })
        .collect()
}

fn group_files(rows: &[PgRow]) -> Result<HashMap<i64, Vec<InvestigationFile>>, CatalogDbError> {
    let mut grouped: HashMap<i64, Vec<InvestigationFile>> = HashMap::new();
    for row in rows {
        let file_name: String = row.try_get("file_name")?;
        let file_bytes = non_negative(row.try_get("file_bytes")?, &file_name, "file_bytes")?;
        let file = InvestigationFile {
            category: row.try_get("category")?,
            file_bytes,
            sha256: row.try_get("sha256")?,
            downloaded_at: row.try_get("downloaded_at")?,
            file_name,
        };
        let experiment_id: i64 = row.try_get("experiment_id")?;
        grouped.entry(experiment_id).or_default().push(file);
    }
    Ok(grouped)
}

fn to_investigation(
    row: &PgRow,
    files: Vec<InvestigationFile>,
) -> Result<Investigation, CatalogDbError> {
    let accession: String = row.try_get("psi_accession")?;
    let program: String = row.try_get("program")?;
    let program =
        Program::parse(&program).ok_or_else(|| invalid(&accession, "program", &program))?;
    let project_type = row
        .try_get::<Option<String>, _>("project_type")?
        .map(|raw| {
            ProjectType::parse(&raw).ok_or_else(|| invalid(&accession, "project_type", &raw))
        })
        .transpose()?;
    let origin: String = row.try_get("origin_category")?;
    let origin_category = OriginCategory::parse(&origin)
        .ok_or_else(|| invalid(&accession, "origin_category", &origin))?;
    let psi_version = row
        .try_get::<Option<i32>, _>("psi_version")?
        .map(|v| u32::try_from(v).map_err(|_| invalid(&accession, "psi_version", v)))
        .transpose()?;
    let total_file_bytes = non_negative(
        row.try_get("total_file_bytes")?,
        &accession,
        "total_file_bytes",
    )?;

    let summary = InvestigationSummary {
        name: row.try_get("name")?,
        title: row.try_get("title")?,
        program,
        project_type,
        sub_research_area: row.try_get("sub_research_area")?,
        hardware: row.try_get("hardware")?,
        start_date: row.try_get("start_date")?,
        end_date: row.try_get("end_date")?,
        file_count: files.len(),
        origin_category,
        accession,
    };
    Ok(Investigation {
        summary,
        psi_version,
        objective: row.try_get("objective")?,
        approach: row.try_get("approach")?,
        hypothesis: row.try_get("hypothesis")?,
        doi: row.try_get("doi")?,
        license: row.try_get("license")?,
        total_file_bytes,
        files,
        ingested_at: row.try_get("ingested_at")?,
    })
}

/// BIGINT do banco → u64 do contrato (o CHECK >= 0 já garante; aqui só confere)
fn non_negative(
    value: Option<i64>,
    record: &str,
    field: &'static str,
) -> Result<Option<u64>, CatalogDbError> {
    value
        .map(|v| u64::try_from(v).map_err(|_| invalid(record, field, v)))
        .transpose()
}

fn invalid(record: &str, field: &'static str, value: impl ToString) -> CatalogDbError {
    CatalogDbError::InvalidRow {
        record: record.to_string(),
        field,
        value: value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use sqlx::Connection;

    use super::*;

    // Duas investigações sintéticas: códigos fora da faixa do PSI real e
    // origin_category Synthetic. A transação é desfeita no fim do teste.
    const SEED_SQL: &str = r#"
WITH e AS (
  INSERT INTO experiments (name, program, psi_accession, psi_version, title,
                           project_type, hardware, start_date, total_file_bytes,
                           raw, ingested_at, origin_category)
  VALUES ('Tex teste sintético PSI-100000', 'FLEX', 'PSI-100000', 2, 'Sintético B',
          'Microgravity Investigation', '{CIR,MDCA}', '2020-01-15', 2048,
          '{"synthetic": true}', '2026-10-28T12:00:00Z', 'Synthetic'),
         ('Tex teste sintético PSI-99999', 'Saffire', 'PSI-99999', NULL, NULL,
          NULL, '{}', NULL, NULL,
          '{"synthetic": true}', NULL, 'Synthetic')
  RETURNING experiment_id, psi_accession
)
INSERT INTO experiment_files (experiment_id, category, file_name, file_bytes)
SELECT experiment_id, 'Experimental table', f, 1024
  FROM e, unnest(ARRAY['b.csv', 'a.csv']) AS f
 WHERE psi_accession = 'PSI-100000'
"#;

    // Só roda com um Postgres migrado (Backend CI ou make up), ex.:
    //   TEX_TEST_DATABASE_URL=postgres://tex:tex@127.0.0.1:5433/tex cargo test
    #[tokio::test]
    async fn le_investigacoes_e_arquivos_do_banco() {
        let Ok(url) = std::env::var("TEX_TEST_DATABASE_URL") else {
            eprintln!("TEX_TEST_DATABASE_URL não definida; teste do banco pulado");
            return;
        };
        let mut conn = PgConnection::connect(&url).await.unwrap();
        let mut tx = conn.begin().await.unwrap();
        sqlx::query(SEED_SQL).execute(&mut *tx).await.unwrap();

        let all = load_investigations(&mut tx).await.unwrap();
        tx.rollback().await.unwrap();

        let index = |code: &str| {
            all.iter()
                .position(|item| item.summary.accession == code)
                .unwrap_or_else(|| panic!("{code} não voltou do banco"))
        };
        let (empty_at, full_at) = (index("PSI-99999"), index("PSI-100000"));
        // Ordem numérica do código, não alfabética
        assert!(empty_at < full_at);

        let empty = &all[empty_at];
        assert_eq!(empty.summary.program, Program::Saffire);
        assert_eq!(empty.summary.project_type, None);
        assert_eq!(empty.summary.file_count, 0);
        assert!(empty.files.is_empty());
        assert_eq!(empty.ingested_at, None);

        let full = &all[full_at];
        let summary = &full.summary;
        assert_eq!(summary.program, Program::Flex);
        assert_eq!(summary.project_type, Some(ProjectType::Microgravity));
        assert_eq!(summary.hardware, ["CIR", "MDCA"]);
        assert_eq!(summary.start_date.as_deref(), Some("2020-01-15"));
        assert_eq!(summary.end_date, None);
        assert_eq!(summary.origin_category, OriginCategory::Synthetic);
        assert_eq!(summary.file_count, 2);
        assert_eq!(full.psi_version, Some(2));
        assert_eq!(full.total_file_bytes, Some(2048));
        let names: Vec<_> = full.files.iter().map(|f| f.file_name.as_str()).collect();
        assert_eq!(names, ["a.csv", "b.csv"]);
        assert_eq!(full.files[0].file_bytes, Some(1024));
        assert_eq!(
            full.ingested_at.as_deref(),
            Some("2026-10-28T12:00:00.000Z")
        );
    }
}
