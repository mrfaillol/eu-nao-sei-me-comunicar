"""A trilha de violoncelo acompanha a tela: cada teste confere uma dessas correspondências, com amostras sintéticas."""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import violoncelo as V  # noqa: E402

SR = V.SR


def _seno(nota: int, segundos: float, decai: bool = False) -> np.ndarray:
    t = np.arange(int(segundos * SR)) / SR
    onda = 0.5 * np.sin(2 * np.pi * 440 * 2 ** ((nota - 69) / 12) * t)
    if decai:
        onda *= np.exp(-t * 6)
    return np.stack([onda, onda], axis=1)


def _banco() -> V.Banco:
    """Um banco sem arquivos: senos puros no lugar das amostras, para a altura e o instante serem mensuráveis."""
    banco = object.__new__(V.Banco)
    notas = [36, 40, 43, 47, 50, 53, 57, 60, 64]
    banco.arco = {d: {n: _seno(n, 6.0) for n in notas} for d in ("suave", "forte")}
    banco.pizz = {d: {n: [_seno(n, 1.5, decai=True)] for n in notas} for d in ("suave", "forte")}
    banco.vez = 0
    return banco


def _frequencia(som: np.ndarray, t: float, janela: float = 0.12) -> float:
    trecho = som[int(t * SR) : int((t + janela) * SR), 0]
    espectro = np.abs(np.fft.rfft(trecho * np.hanning(len(trecho)), 1 << 16))
    return float(np.fft.rfftfreq(1 << 16, 1 / SR)[espectro.argmax()])


def _forca(som: np.ndarray, de: float, ate: float) -> float:
    return float(np.abs(som[int(de * SR) : int(ate * SR)]).max(initial=0.0))


def _hz(nota: int) -> float:
    return 440 * 2 ** ((nota - 69) / 12)


def test_altura_na_tela_vira_nota_da_escala_embaixo_grave_em_cima_agudo():
    assert V.nota_da_altura(1.0) == 38 and V.nota_da_altura(0.0) == 62
    notas = [V.nota_da_altura(y / 20) for y in range(21)]
    assert all(n in V.ESCALA for n in notas)
    assert notas == sorted(notas, reverse=True)
    assert V.nota_da_altura(-3) == 62 and V.nota_da_altura(9) == 38


def test_o_nome_do_arquivo_esta_uma_oitava_abaixo_do_que_soa():
    # Medido nas amostras: "D2" soa 147 Hz (ré 3, nota 50) e "A2" soa 220 Hz (lá 3, nota 57).
    assert V.nota_do_nome("D2") == 50 and V.nota_do_nome("A2") == 57 and V.nota_do_nome("C1") == 36


def test_clique_vira_pizzicato_no_instante_do_clique():
    dados = {"fim": 3.0, "eventos": [{"tipo": "clique", "papel": "escolha", "t": 1.0, "x": 0.5, "y": 0.5}, {"tipo": "clique", "papel": "ver-frase", "t": 2.9, "x": 0.5, "y": 0.9}]}
    som = V.compor(dados, _banco()).som
    assert _forca(som, 0.9, 0.995) == 0.0  # a nota de abertura já saiu, e o pizzicato não se adianta
    assert _forca(som, 1.0, 1.012) > 0.01  # começa a soar em menos de meio quadro de vídeo


def test_movimento_para_cima_sobe_a_nota_e_para_na_altura_do_cursor():
    movimento = {"tipo": "movimento", "t0": 0.5, "t1": 1.5, "de": {"x": 0.2, "y": 1.0}, "para": {"x": 0.8, "y": 0.0}}
    som = V.compor({"fim": 3.0, "eventos": [movimento]}, _banco()).som
    assert abs(_frequencia(som, 0.5, 0.05) - _hz(38)) < 12  # começa no ré grave
    meio = _frequencia(som, 0.95)
    assert _hz(38) * 1.3 < meio < _hz(62) * 0.8  # no meio do caminho ainda está deslizando
    assert abs(_frequencia(som, 1.52) - _hz(62)) < 8  # chega ao ré agudo quando o cursor para


def test_o_lado_da_tela_e_o_lado_do_som():
    def lado(x: float) -> float:
        movimento = {"tipo": "movimento", "t0": 0.2, "t1": 0.8, "de": {"x": x, "y": 0.5}, "para": {"x": x, "y": 0.4}}
        som = V.compor({"fim": 2.0, "eventos": [movimento]}, _banco()).som
        return float(np.abs(som[:, 1]).max() / np.abs(som[:, 0]).max())

    assert lado(0.05) < 1 < lado(0.95)


def test_cada_escolha_deixa_uma_nota_que_soa_ate_a_frase_ser_pedida():
    dados = {"fim": 16.0, "eventos": [{"tipo": "clique", "papel": "escolha", "t": 1.0, "x": 0.5, "y": 0.5}, {"tipo": "clique", "papel": "ver-frase", "t": 14.0, "x": 0.5, "y": 0.9}]}
    som = V.compor(dados, _banco()).som
    # Entre a escolha e o pedido passam 13 s, mais que os 6 s da amostra: a nota precisa ser sustentada.
    assert _forca(som, 8.0, 8.2) > 0.01 and _forca(som, 13.0, 13.2) > 0.01
    assert abs(_frequencia(som, 8.0) - _hz(V.ACORDE_DAS_ESCOLHAS[0])) < 4


def test_a_aproximacao_da_camera_cresce_sustenta_e_some():
    dados = {"fim": 6.0, "ida_da_camera": 0.8, "eventos": [{"tipo": "marca", "nome": "dicionário", "t": 1.0, "segura": 2.6}]}
    som = V.compor(dados, _banco()).som
    assert _forca(som, 0.9, 0.995) == 0.0
    assert _forca(som, 1.05, 1.15) < 0.25 * _forca(som, 1.8, 1.9)  # ainda chegando
    assert _forca(som, 4.2, 4.3) < 0.1 * _forca(som, 2.5, 2.6)  # a câmera já voltou


def test_sustentar_alonga_sem_estalo():
    nota = _seno(50, 6.0)
    longa = V.sustentar(nota, 12 * SR)
    assert len(longa) >= 12 * SR
    # Um estalo seria um salto entre amostras vizinhas maior que o do próprio seno.
    assert np.abs(np.diff(longa[:, 0])).max() <= np.abs(np.diff(nota[:, 0])).max() * 1.6
    assert V.sustentar(nota, 2 * SR) is nota


def test_ler_com_velocidade_dobrada_sobe_uma_oitava():
    som = V.ler_com_velocidade(_seno(50, 2.0), np.full(SR // 2, 2.0))
    assert abs(_frequencia(som, 0.1) - _hz(62)) < 6


def test_a_abertura_cresce_ate_o_primeiro_gesto_e_sai_antes_dele():
    dados = {"fim": 6.0, "eventos": [{"tipo": "clique", "papel": "tocar", "t": 3.0, "x": 0.5, "y": 0.5}]}
    som = V.compor(dados, _banco()).som
    assert _forca(som, 0.4, 0.6) < _forca(som, 1.6, 1.8)
    assert abs(_frequencia(som, 1.5) - _hz(38)) < 4
    assert _forca(som, 2.9, 2.995) == 0.0
